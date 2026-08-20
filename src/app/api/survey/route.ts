import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
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
 * Recebe e persiste uma resposta da pesquisa de experiência Neoprop.
 *
 * - Validação por whitelist de todos os valores de escolha;
 * - Sanitização dos campos abertos (trim, remoção de caracteres de
 *   controle, limite de tamanho);
 * - Idempotência: o id vem do cliente — reenvio do mesmo id responde ok
 *   sem duplicar (previne duplo clique/reenvio após queda de rede);
 * - Antispam sem atrito: honeypot + tempo mínimo de preenchimento marcam
 *   a resposta com "flagged", mas NUNCA a descartam silenciosamente;
 * - Rate limit simples por IP (memória do processo).
 */

const RATE_LIMIT = 10; // envios por IP por hora
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
};

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const id = clean(body.responseId, 64);
  const a = body.answers;
  if (!id || id.length < 8 || !a || typeof a !== "object") {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }

  /* --- Identificação do respondente (primeira etapa, obrigatória) ---- */

  const respondentName = clean(a.respondentName, 200);
  const respondentEmail = clean(a.respondentEmail, 200).toLowerCase();
  const respondentWhatsapp = clean(a.respondentWhatsapp, 30).replace(/\D/g, "");
  if (
    respondentName.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail) ||
    respondentWhatsapp.length < 10 ||
    respondentWhatsapp.length > 13
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_answers" },
      { status: 400 }
    );
  }

  /* --- Campos obrigatórios ------------------------------------------ */

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

  const deskMotivationList = cleanArray(a.deskMotivations, deskMotivations, deskMotivations.length);
  const valuePoints = cleanArray(a.valuePoints, valueOptions(journeyStage), 2);
  const improvePoints = cleanArray(a.improvePoints, improveOptions(journeyStage), 3);
  const desiredContentList = cleanArray(a.desiredContents, desiredContents, 3);

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

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "invalid_answers" },
      { status: 400 }
    );
  }

  /* --- Ramificações: aceita apenas o que a jornada/seleções permitem -- */

  const answersForBranch = {
    ...a,
    valuePoints,
    improvePoints,
    journeyStage,
  } as SurveyAnswers;

  const supportActive = supportBranchActive(answersForBranch);
  const supportOutcome = supportActive ? clean(a.supportOutcome, 40) : "";
  const supportEase = supportActive ? intInRange(a.supportEase, 1, 5) : null;
  if (supportActive && (!inSet(supportOutcome, supportOutcomes) || supportEase === null)) {
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  }

  const failureActive = reprovedOrAbandonedStages.has(journeyStage);
  const failureFactor = failureActive ? clean(a.failureFactor, 40) : "";
  if (failureActive && !inSet(failureFactor, failureFactors)) {
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  }

  const transitionActive = realAccountStages.has(journeyStage);
  const realAccountTransition = transitionActive
    ? clean(a.realAccountTransition, 40)
    : "";
  if (transitionActive && !inSet(realAccountTransition, transitions)) {
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  }

  const withdrawalActive = withdrawalStages.has(journeyStage);
  const withdrawalExperience = withdrawalActive
    ? clean(a.withdrawalExperience, 40)
    : "";
  if (withdrawalActive && !inSet(withdrawalExperience, withdrawalExperiences)) {
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  }

  const barrierRequired = repurchaseIntent !== REPURCHASE_FIRST_CHOICE;
  const repurchaseBarrier = barrierRequired
    ? cleanArray(a.repurchaseBarrier, repurchaseBarriers, 3)
    : [];
  if (barrierRequired && repurchaseBarrier === null) {
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  }

  // Detalhes obrigatórios: quem marca "Outro" ou relata um problema
  // crítico precisa escrever o que aconteceu (espelha a validação do cliente).
  const missingRequiredDetail =
    (firstContact === "other" && !cleanOptional(a.firstContactDetail)) ||
    (tradeMotivation === "other" && !cleanOptional(a.tradeMotivationOther)) ||
    (deskMotivationList.includes("other") && !cleanOptional(a.deskMotivationsOther)) ||
    (valuePoints.includes("other") && !cleanOptional(a.valuePointsOther)) ||
    (improvePoints.includes("other") && !cleanOptional(a.improvePointsOther)) ||
    (criticalTheme(improvePoints) !== null && !cleanOptional(a.improveDetail)) ||
    (failureActive && failureFactor === "other" && !cleanOptional(a.failureFactorOther)) ||
    (withdrawalActive &&
      withdrawalProblemValues.has(withdrawalExperience) &&
      !cleanOptional(a.withdrawalDetail)) ||
    (barrierRequired &&
      (repurchaseBarrier ?? []).includes("other") &&
      !cleanOptional(a.repurchaseBarrierOther)) ||
    (priorityFix === "other" && !cleanOptional(a.priorityFixOther));
  if (missingRequiredDetail) {
    return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
  }

  const customerRef = cleanOptional(body.customerRef, 200);

  /* --- Classificação interna + antispam ------------------------------ */

  const npsBand =
    npsScore <= 6 ? "detractor" : npsScore <= 8 ? "neutral" : "promoter";

  const elapsedMs = intInRange(body.elapsedMs, 0, 24 * 60 * 60 * 1000);
  let flagged: string | null = null;
  if (clean(body.website, 200)) flagged = "honeypot";
  else if (elapsedMs !== null && elapsedMs < 15_000) flagged = "too_fast";

  const detailTheme = criticalTheme(improvePoints);

  /* --- Persistência --------------------------------------------------- */

  const data = {
    id,
    customerRef,
    respondentName,
    respondentEmail,
    respondentWhatsapp,
    npsScore,
    npsBand,
    npsReason: cleanOptional(a.npsReason),
    journeyStage,
    journeyStageSource: a.journeyStageSource === "url" ? "url" : "form",
    firstContact,
    firstContactDetail: cleanOptional(a.firstContactDetail),
    otherFirms,
    otherFirmsNames: otherFirms === "yes" ? cleanOptional(a.otherFirmsNames) : null,
    tradeMotivation,
    tradeMotivationOther:
      tradeMotivation === "other" ? cleanOptional(a.tradeMotivationOther) : null,
    deskMotivations: deskMotivationList,
    deskMotivationsOther: deskMotivationList.includes("other")
      ? cleanOptional(a.deskMotivationsOther)
      : null,
    expectation,
    valuePoints,
    valuePointsOther: valuePoints.includes("other")
      ? cleanOptional(a.valuePointsOther)
      : null,
    improvePoints,
    improvePointsOther: improvePoints.includes("other")
      ? cleanOptional(a.improvePointsOther)
      : null,
    improveDetailTheme: detailTheme,
    improveDetail: detailTheme ? cleanOptional(a.improveDetail) : null,
    supportOutcome: supportActive ? supportOutcome : null,
    supportEase,
    failureFactor: failureActive ? failureFactor : null,
    failureFactorOther:
      failureActive && failureFactor === "other"
        ? cleanOptional(a.failureFactorOther)
        : null,
    realAccountTransition: transitionActive ? realAccountTransition : null,
    withdrawalExperience: withdrawalActive ? withdrawalExperience : null,
    withdrawalDetail: withdrawalActive ? cleanOptional(a.withdrawalDetail) : null,
    trustScore,
    communication,
    desiredContents: desiredContentList,
    repurchaseIntent,
    repurchaseBarrier: repurchaseBarrier ?? [],
    repurchaseBarrierOther:
      barrierRequired && (repurchaseBarrier ?? []).includes("other")
        ? cleanOptional(a.repurchaseBarrierOther)
        : null,
    priorityFix,
    priorityFixOther:
      priorityFix === "other" ? cleanOptional(a.priorityFixOther) : null,
    preserve: cleanOptional(a.preserve),
    utmSource: cleanOptional(body.utm_source, 200),
    utmMedium: cleanOptional(body.utm_medium, 200),
    utmCampaign: cleanOptional(body.utm_campaign, 200),
    utmContent: cleanOptional(body.utm_content, 200),
    utmTerm: cleanOptional(body.utm_term, 200),
    referrer: cleanOptional(body.referrer, 500),
    clientDurationMs: elapsedMs,
    flagged,
  };

  try {
    await prisma.surveyResponse.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Mesmo id já gravado (reenvio) — idempotente, sem duplicar.
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[survey] Falha ao gravar resposta:", error);
    return NextResponse.json(
      { ok: false, error: "storage_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
