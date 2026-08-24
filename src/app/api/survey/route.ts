import { NextRequest, NextResponse } from "next/server";
import { upsertRow, sheetConfigured } from "@/lib/sheet";
import { cell, type SurveyRow } from "@/lib/survey-row";
import {
  type SurveyAnswers,
  journeyStages,
  firstContacts,
  tradeMotivations,
  deskMotivations,
  expectations,
  valueOptions,
  improveOptions,
  criticalTheme,
  supportOutcomes,
  failureFactors,
  transitions,
  withdrawalExperiences,
  withdrawalProblemValues,
  communications,
  desiredContents,
  repurchaseIntents,
  repurchaseBarriers,
  priorityOptions,
  REPURCHASE_FIRST_CHOICE,
  reprovedOrAbandonedStages,
  realAccountStages,
  withdrawalStages,
  supportBranchActive,
} from "@/components/pesquisa/survey-data";

export const dynamic = "force-dynamic";

/**
 * Recebe uma resposta da pesquisa e grava na planilha do Google.
 *
 * Dois modos, ambos gravando na MESMA linha (upsert pelo `id`):
 *
 *  - parcial (`partial: true`): disparado a cada passo respondido. Aceita
 *    respostas incompletas, valida só o que veio preenchido e marca a linha
 *    como "parcial". É o que garante o registro de quem abandona no meio;
 *  - final: validação estrita por whitelist de todos os campos obrigatórios
 *    e das ramificações, e marca a linha como "completo".
 *
 * Outras garantias mantidas do desenho original:
 *  - sanitização dos campos abertos (trim, controle, limite de tamanho);
 *  - idempotência pelo `id` gerado no cliente (reenvio não duplica linha);
 *  - antispam sem atrito: honeypot + tempo mínimo marcam "flagged", nunca
 *    descartam a resposta silenciosamente;
 *  - rate limit por IP (memória do processo).
 */

// Parciais gravam a cada passo, então o teto por IP é bem mais alto que o
// de envios finais — são ~20 escritas por respondente numa pesquisa inteira.
const RATE_LIMIT = 120; // requisições por IP por hora
const rateMap = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const hits = (rateMap.get(ip) ?? []).filter((t) => t > windowStart);
  if (hits.length >= RATE_LIMIT) {
    rateMap.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateMap.set(ip, hits);
  // higiene: evita crescimento sem limite
  if (rateMap.size > 5000) {
    for (const [key, value] of rateMap) {
      if (value.every((t) => t <= windowStart)) rateMap.delete(key);
    }
  }
  return false;
}

function clean(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
}

function cleanOptional(value: unknown, max = 2000): string | null {
  const v = clean(value, max);
  return v || null;
}

function inSet(value: string, options: { value: string }[]): boolean {
  return options.some((o) => o.value === value);
}

function intInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * Filtra um array pela whitelist. Devolve null quando o conteúdo é inválido
 * (vazio ou acima do limite) — no modo parcial o chamador trata null como
 * "ainda não respondido" em vez de erro.
 */
function cleanArray(
  value: unknown,
  options: { value: string }[],
  maxItems: number
): string[] | null {
  if (!Array.isArray(value)) return null;
  const filtered = value
    .filter((v): v is string => typeof v === "string")
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .filter((v) => inSet(v, options));
  if (filtered.length === 0 || filtered.length > maxItems) return null;
  return filtered;
}

type SubmitBody = {
  responseId?: string;
  answers?: Partial<SurveyAnswers>;
  customerRef?: string;
  elapsedMs?: number;
  referrer?: string;
  website?: string; // honeypot
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** true = autosave de progresso; ausente/false = envio final */
  partial?: boolean;
  /** contexto do autosave, só para leitura humana na planilha */
  lastStep?: string;
  stepNumber?: number;
  stepTotal?: number;
};

const invalid = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return invalid("rate_limited", 429);

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return invalid("invalid_json");
  }

  const id = clean(body.responseId, 64);
  const a = body.answers;
  if (!id || id.length < 8 || !a || typeof a !== "object") {
    return invalid("invalid_payload");
  }

  const partial = body.partial === true;

  /* --- Identificação do respondente (primeira etapa) ------------------ */

  const respondentName = clean(a.respondentName, 200);
  const respondentEmail = clean(a.respondentEmail, 200).toLowerCase();
  const respondentWhatsapp = clean(a.respondentWhatsapp, 30).replace(/\D/g, "");
  const identityValid =
    respondentName.length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail) &&
    respondentWhatsapp.length >= 10 &&
    respondentWhatsapp.length <= 13;

  // No final a identificação é obrigatória. No parcial, uma linha sem nenhum
  // dado de contato não serve para nada — melhor não poluir a planilha.
  if (!identityValid) {
    if (!partial) return invalid("invalid_answers");
    if (!respondentName && !respondentEmail && !respondentWhatsapp) {
      return NextResponse.json({ ok: true, skipped: "sem_identificacao" });
    }
  }

  /* --- Campos de escolha única --------------------------------------- */

  const npsScore = intInRange(a.npsScore, 0, 10);
  const trustScore = intInRange(a.trustScore, 0, 10);
  const journeyStage = clean(a.journeyStage, 40);
  const firstContact = clean(a.firstContact, 40);
  const otherFirms = clean(a.otherFirms, 10);
  const tradeMotivation = clean(a.tradeMotivation, 40);
  const expectation = clean(a.expectation, 40);
  const communication = clean(a.communication, 40);
  const repurchaseIntent = clean(a.repurchaseIntent, 40);
  const priorityFix = clean(a.priorityFix, 40);

  const deskMotivationList = cleanArray(
    a.deskMotivations,
    deskMotivations,
    deskMotivations.length
  );
  const valuePoints = cleanArray(a.valuePoints, valueOptions(journeyStage), 2);
  const improvePoints = cleanArray(a.improvePoints, improveOptions(journeyStage), 3);
  const desiredContentList = cleanArray(a.desiredContents, desiredContents, 3);

  if (!partial) {
    const valid =
      npsScore !== null &&
      trustScore !== null &&
      inSet(journeyStage, journeyStages) &&
      inSet(firstContact, firstContacts) &&
      (otherFirms === "yes" || otherFirms === "no") &&
      inSet(tradeMotivation, tradeMotivations) &&
      inSet(expectation, expectations) &&
      inSet(communication, communications) &&
      inSet(repurchaseIntent, repurchaseIntents) &&
      inSet(priorityFix, priorityOptions(journeyStage)) &&
      deskMotivationList !== null &&
      valuePoints !== null &&
      improvePoints !== null &&
      desiredContentList !== null;
    if (!valid) return invalid("invalid_answers");
  }

  /* --- Ramificações: aceita apenas o que a jornada/seleções permitem -- */

  const answersForBranch = {
    ...a,
    valuePoints: valuePoints ?? [],
    improvePoints: improvePoints ?? [],
    journeyStage,
  } as SurveyAnswers;

  const supportActive = supportBranchActive(answersForBranch);
  const supportOutcome = supportActive ? clean(a.supportOutcome, 40) : "";
  const supportEase = supportActive ? intInRange(a.supportEase, 1, 5) : null;
  if (
    !partial &&
    supportActive &&
    (!inSet(supportOutcome, supportOutcomes) || supportEase === null)
  ) {
    return invalid("invalid_answers");
  }

  const failureActive = reprovedOrAbandonedStages.has(journeyStage);
  const failureFactor = failureActive ? clean(a.failureFactor, 40) : "";
  if (!partial && failureActive && !inSet(failureFactor, failureFactors)) {
    return invalid("invalid_answers");
  }

  const transitionActive = realAccountStages.has(journeyStage);
  const realAccountTransition = transitionActive
    ? clean(a.realAccountTransition, 40)
    : "";
  if (!partial && transitionActive && !inSet(realAccountTransition, transitions)) {
    return invalid("invalid_answers");
  }

  const withdrawalActive = withdrawalStages.has(journeyStage);
  const withdrawalExperience = withdrawalActive
    ? clean(a.withdrawalExperience, 40)
    : "";
  if (
    !partial &&
    withdrawalActive &&
    !inSet(withdrawalExperience, withdrawalExperiences)
  ) {
    return invalid("invalid_answers");
  }

  const barrierRequired = repurchaseIntent !== REPURCHASE_FIRST_CHOICE;
  const repurchaseBarrier = barrierRequired
    ? cleanArray(a.repurchaseBarrier, repurchaseBarriers, 3)
    : [];
  if (!partial && barrierRequired && repurchaseBarrier === null) {
    return invalid("invalid_answers");
  }

  // Detalhes obrigatórios: quem marca "Outro" ou relata um problema
  // crítico precisa escrever o que aconteceu (espelha a validação do cliente).
  if (!partial) {
    const missingRequiredDetail =
      (firstContact === "other" && !cleanOptional(a.firstContactDetail)) ||
      (tradeMotivation === "other" && !cleanOptional(a.tradeMotivationOther)) ||
      ((deskMotivationList ?? []).includes("other") &&
        !cleanOptional(a.deskMotivationsOther)) ||
      ((valuePoints ?? []).includes("other") && !cleanOptional(a.valuePointsOther)) ||
      ((improvePoints ?? []).includes("other") &&
        !cleanOptional(a.improvePointsOther)) ||
      (criticalTheme(improvePoints ?? []) !== null && !cleanOptional(a.improveDetail)) ||
      (failureActive &&
        failureFactor === "other" &&
        !cleanOptional(a.failureFactorOther)) ||
      (withdrawalActive &&
        withdrawalProblemValues.has(withdrawalExperience) &&
        !cleanOptional(a.withdrawalDetail)) ||
      (barrierRequired &&
        (repurchaseBarrier ?? []).includes("other") &&
        !cleanOptional(a.repurchaseBarrierOther)) ||
      (priorityFix === "other" && !cleanOptional(a.priorityFixOther));
    if (missingRequiredDetail) return invalid("invalid_answers");
  }

  /* --- Classificação interna + antispam ------------------------------ */

  const npsBand =
    npsScore === null
      ? null
      : npsScore <= 6
        ? "detractor"
        : npsScore <= 8
          ? "neutral"
          : "promoter";

  const elapsedMs = intInRange(body.elapsedMs, 0, 24 * 60 * 60 * 1000);
  let flagged: string | null = null;
  if (clean(body.website, 200)) flagged = "honeypot";
  // "rápido demais" só faz sentido no envio final — um parcial é rápido por natureza
  else if (!partial && elapsedMs !== null && elapsedMs < 15_000) flagged = "too_fast";

  const detailTheme = criticalTheme(improvePoints ?? []);

  const stepNumber = intInRange(body.stepNumber, 1, 99);
  const stepTotal = intInRange(body.stepTotal, 1, 99);

  /* --- Linha da planilha ---------------------------------------------- */

  const row: SurveyRow = {
    id,
    updatedAt: new Date().toISOString(),
    status: partial ? "parcial" : "completo",
    lastStep: cell(clean(body.lastStep, 40)),
    progress: stepNumber && stepTotal ? `${stepNumber}/${stepTotal}` : null,
    respondentName: cell(respondentName),
    respondentEmail: cell(respondentEmail),
    respondentWhatsapp: cell(respondentWhatsapp),
    customerRef: cell(cleanOptional(body.customerRef, 200)),
    npsScore,
    npsBand: cell(npsBand),
    npsReason: cell(cleanOptional(a.npsReason)),
    journeyStage: cell(journeyStage),
    journeyStageSource: a.journeyStageSource === "url" ? "url" : "form",
    firstContact: cell(firstContact),
    firstContactDetail: cell(cleanOptional(a.firstContactDetail)),
    otherFirms: cell(otherFirms),
    otherFirmsNames:
      otherFirms === "yes" ? cell(cleanOptional(a.otherFirmsNames)) : null,
    tradeMotivation: cell(tradeMotivation),
    tradeMotivationOther:
      tradeMotivation === "other" ? cell(cleanOptional(a.tradeMotivationOther)) : null,
    deskMotivations: cell(deskMotivationList),
    deskMotivationsOther: (deskMotivationList ?? []).includes("other")
      ? cell(cleanOptional(a.deskMotivationsOther))
      : null,
    expectation: cell(expectation),
    valuePoints: cell(valuePoints),
    valuePointsOther: (valuePoints ?? []).includes("other")
      ? cell(cleanOptional(a.valuePointsOther))
      : null,
    improvePoints: cell(improvePoints),
    improvePointsOther: (improvePoints ?? []).includes("other")
      ? cell(cleanOptional(a.improvePointsOther))
      : null,
    improveDetailTheme: cell(detailTheme),
    improveDetail: detailTheme ? cell(cleanOptional(a.improveDetail)) : null,
    supportOutcome: supportActive ? cell(supportOutcome) : null,
    supportEase,
    failureFactor: failureActive ? cell(failureFactor) : null,
    failureFactorOther:
      failureActive && failureFactor === "other"
        ? cell(cleanOptional(a.failureFactorOther))
        : null,
    realAccountTransition: transitionActive ? cell(realAccountTransition) : null,
    withdrawalExperience: withdrawalActive ? cell(withdrawalExperience) : null,
    withdrawalDetail: withdrawalActive ? cell(cleanOptional(a.withdrawalDetail)) : null,
    trustScore,
    communication: cell(communication),
    desiredContents: cell(desiredContentList),
    repurchaseIntent: cell(repurchaseIntent),
    repurchaseBarrier: cell(repurchaseBarrier),
    repurchaseBarrierOther:
      barrierRequired && (repurchaseBarrier ?? []).includes("other")
        ? cell(cleanOptional(a.repurchaseBarrierOther))
        : null,
    priorityFix: cell(priorityFix),
    priorityFixOther:
      priorityFix === "other" ? cell(cleanOptional(a.priorityFixOther)) : null,
    preserve: cell(cleanOptional(a.preserve)),
    utmSource: cell(cleanOptional(body.utm_source, 200)),
    utmMedium: cell(cleanOptional(body.utm_medium, 200)),
    utmCampaign: cell(cleanOptional(body.utm_campaign, 200)),
    utmContent: cell(cleanOptional(body.utm_content, 200)),
    utmTerm: cell(cleanOptional(body.utm_term, 200)),
    referrer: cell(cleanOptional(body.referrer, 500)),
    clientDurationMs: elapsedMs,
    flagged: cell(flagged),
  };

  if (!sheetConfigured()) {
    console.error("[survey] SHEETS_WEBHOOK_URL/SHEETS_TOKEN ausentes.");
    // Sem planilha configurada um parcial some em silêncio (é só progresso),
    // mas o envio final precisa avisar o usuário em vez de fingir sucesso.
    return partial
      ? NextResponse.json({ ok: true, skipped: "sheet_not_configured" })
      : invalid("storage_failed", 500);
  }

  const result = await upsertRow(row);
  if (!result.ok) {
    console.error("[survey] Falha ao gravar na planilha:", result.error);
    return partial
      ? NextResponse.json({ ok: true, skipped: result.error })
      : invalid("storage_failed", 500);
  }

  return NextResponse.json({ ok: true, created: result.created });
}
