"use client";

/**
 * Formulário progressivo da pesquisa: uma pergunta (ou um pequeno bloco
 * relacionado) por etapa, com barra de progresso, Voltar/Continuar,
 * ramificações condicionais, rascunho em localStorage (retomada após
 * refresh) e envio idempotente ao servidor.
 *
 * O rascunho local é apenas recuperação de sessão — a persistência
 * definitiva acontece no POST /api/survey (Postgres via Prisma).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getStoredUtms } from "@/lib/utm";
import {
  type SurveyAnswers,
  emptyAnswers,
  journeyStages,
  firstContacts,
  firstContactDetailLabel,
  tradeMotivations,
  deskMotivations,
  expectations,
  valueOptions,
  improveOptions,
  VALUE_NONE,
  IMPROVE_NONE,
  criticalTheme,
  themeLabel,
  supportOutcomes,
  failureFactors,
  transitions,
  withdrawalExperiences,
  withdrawalProblemValues,
  communications,
  desiredContents,
  NO_MARKETING,
  repurchaseIntents,
  repurchaseBarriers,
  priorityOptions,
  REPURCHASE_FIRST_CHOICE,
  reprovedOrAbandonedStages,
  realAccountStages,
  withdrawalStages,
  supportBranchActive,
  npsReasonQuestion,
} from "./survey-data";
import {
  QuestionBlock,
  ScaleInput,
  SingleChoice,
  MultiChoice,
  OpenText,
  ShortText,
} from "./inputs";

export const DRAFT_KEY = "np_survey_draft_v1";
export const DONE_KEY = "np_survey_done_v1";

type StepId =
  | "identity"
  | "nps"
  | "npsReason"
  | "journey"
  | "origin"
  | "otherFirms"
  | "tradeMotivation"
  | "deskMotivations"
  | "expectation"
  | "value"
  | "improve"
  | "improveDetail"
  | "support"
  | "failure"
  | "transition"
  | "withdrawal"
  | "trust"
  | "communication"
  | "contents"
  | "repurchase"
  | "barrier"
  | "priority"
  | "preserve";

type Draft = {
  v: 1;
  id: string;
  startedAt: number;
  stepIndex: number;
  answers: SurveyAnswers;
  referrer: string;
};

/**
 * Ordem intencional, em quatro blocos narrativos:
 *
 *  1. Sua história — perguntas pessoais e sem julgamento (aquecimento):
 *     do passado (por que entrou no trade) ao presente (momento atual).
 *  2. Sua experiência — avaliação do que foi vivido, com as ramificações
 *     logo depois dos temas que as disparam.
 *  3. Confiança e comunicação — percepções sobre a relação com a empresa.
 *  4. Daqui para frente — síntese: recompra, recomendação (NPS) e as
 *     reflexões finais. O NPS fica aqui de propósito: no início soaria
 *     como venda/captação; no fim, é a conclusão natural da conversa.
 */
function computeSteps(a: SurveyAnswers, stageFromUrl: boolean): StepId[] {
  const steps: StepId[] = ["identity", "tradeMotivation", "deskMotivations", "otherFirms", "origin"];
  if (!stageFromUrl) steps.push("journey");
  steps.push("expectation", "value", "improve");
  if (criticalTheme(a.improvePoints)) steps.push("improveDetail");
  if (supportBranchActive(a)) steps.push("support");
  if (reprovedOrAbandonedStages.has(a.journeyStage)) steps.push("failure");
  if (realAccountStages.has(a.journeyStage)) steps.push("transition");
  if (withdrawalStages.has(a.journeyStage)) steps.push("withdrawal");
  steps.push("trust", "communication", "contents", "repurchase");
  if (a.repurchaseIntent && a.repurchaseIntent !== REPURCHASE_FIRST_CHOICE) {
    steps.push("barrier");
  }
  steps.push("nps", "npsReason", "priority", "preserve");
  return steps;
}

/** Rótulo do bloco exibido acima de cada pergunta. */
const SECTION_OF: Record<StepId, string> = {
  identity: "Identificação",
  tradeMotivation: "Sua história",
  deskMotivations: "Sua história",
  otherFirms: "Sua história",
  origin: "Sua história",
  journey: "Sua história",
  expectation: "Sua experiência",
  value: "Sua experiência",
  improve: "Sua experiência",
  improveDetail: "Sua experiência",
  support: "Sua experiência",
  failure: "Sua experiência",
  transition: "Sua experiência",
  withdrawal: "Sua experiência",
  trust: "Confiança e comunicação",
  communication: "Confiança e comunicação",
  contents: "Confiança e comunicação",
  repurchase: "Daqui para frente",
  barrier: "Daqui para frente",
  nps: "Daqui para frente",
  npsReason: "Daqui para frente",
  priority: "Daqui para frente",
  preserve: "Daqui para frente",
};

function newResponseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `np-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (parsed?.v !== 1 || !parsed.id || !parsed.answers) return null;
    const answers = { ...emptyAnswers, ...parsed.answers };
    // Rascunhos antigos podem ter formato divergente nos campos de lista
    for (const key of [
      "deskMotivations",
      "valuePoints",
      "improvePoints",
      "desiredContents",
      "repurchaseBarrier",
    ] as const) {
      if (!Array.isArray(answers[key])) answers[key] = [];
    }
    return { ...parsed, answers };
  } catch {
    return null;
  }
}

export function SurveyWizard({
  customerRef,
  urlStage,
  prefill,
  onDone,
}: {
  /** Identificação vinda do CRM/URL (cid/e-mail), quando disponível. */
  customerRef: string;
  /** Estágio da jornada confiável vindo da URL (já validado), ou "". */
  urlStage: string;
  /** Dados do respondente vindos da URL (CRM) para pré-preencher. */
  prefill: { name: string; email: string; whatsapp: string };
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "failed">(
    "idle"
  );
  const [honeypot, setHoneypot] = useState("");
  const stepTopRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Inicialização: retoma rascunho ou cria um novo.
  useEffect(() => {
    const seedPrefill = (answers: SurveyAnswers) => {
      if (!answers.respondentName && prefill.name)
        answers.respondentName = prefill.name;
      if (!answers.respondentEmail && prefill.email)
        answers.respondentEmail = prefill.email;
      if (!answers.respondentWhatsapp && prefill.whatsapp)
        answers.respondentWhatsapp = prefill.whatsapp;
    };
    const existing = loadDraft();
    if (existing) {
      if (urlStage && existing.answers.journeyStageSource === "url") {
        existing.answers.journeyStage = urlStage;
      }
      seedPrefill(existing.answers);
      setDraft(existing);
      return;
    }
    const answers = { ...emptyAnswers };
    if (urlStage) {
      answers.journeyStage = urlStage;
      answers.journeyStageSource = "url";
    }
    seedPrefill(answers);
    setDraft({
      v: 1,
      id: newResponseId(),
      startedAt: Date.now(),
      stepIndex: 0,
      answers,
      referrer: document.referrer || "",
    });
  }, [urlStage, prefill]);

  // Persiste o rascunho a cada mudança (apenas recuperação de sessão).
  useEffect(() => {
    if (!draft) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage indisponível — a pesquisa segue funcionando sem retomada
    }
  }, [draft]);

  const answers = draft?.answers ?? emptyAnswers;
  const stageFromUrl = Boolean(urlStage);
  const steps = useMemo(
    () => computeSteps(answers, stageFromUrl),
    [answers, stageFromUrl]
  );
  const stepIndex = Math.min(draft?.stepIndex ?? 0, steps.length - 1);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const update = useCallback((patch: Partial<SurveyAnswers>) => {
    setError(null);
    setDraft((d) =>
      d ? { ...d, answers: { ...d.answers, ...patch } } : d
    );
  }, []);

  const goTo = useCallback((index: number) => {
    setError(null);
    setDraft((d) => (d ? { ...d, stepIndex: Math.max(0, index) } : d));
  }, []);

  // Ao trocar de etapa: rola para o topo do formulário e move o foco.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = stepTopRef.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    el.focus({ preventScroll: true });
  }, [stepIndex]);

  /** Validação da etapa atual; retorna mensagem de erro ou null. */
  const validate = (): string | null => {
    const a = answers;
    switch (step) {
      case "identity": {
        if (a.respondentName.trim().length < 2)
          return "Informe seu nome para continuar.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.respondentEmail.trim()))
          return "Informe um e-mail válido para continuar.";
        const digits = a.respondentWhatsapp.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 13)
          return "Informe um WhatsApp válido, com DDD.";
        return null;
      }
      case "nps":
        return a.npsScore === null ? "Escolha uma nota de 0 a 10 para continuar." : null;
      case "journey":
        return a.journeyStage ? null : "Escolha a opção que melhor descreve seu momento.";
      case "origin":
        if (!a.firstContact) return "Escolha uma opção para continuar.";
        if (a.firstContact === "other" && !a.firstContactDetail.trim())
          return "Conte como você conheceu a Neoprop para continuar.";
        return null;
      case "otherFirms":
        if (!a.otherFirms) return "Escolha uma opção para continuar.";
        if (a.otherFirms === "yes" && !a.otherFirmsNames.trim())
          return "Conte em quais mesas você já comprou.";
        return null;
      case "tradeMotivation":
        if (!a.tradeMotivation) return "Escolha o principal motivo para continuar.";
        if (a.tradeMotivation === "other" && !a.tradeMotivationOther.trim())
          return "Conte qual foi o principal motivo para continuar.";
        return null;
      case "deskMotivations":
        if (a.deskMotivations.length === 0)
          return "Selecione ao menos uma opção para continuar.";
        if (a.deskMotivations.includes("other") && !a.deskMotivationsOther.trim())
          return "Escreva o que também levou você a escolher uma mesa.";
        return null;
      case "expectation":
        return a.expectation ? null : "Escolha uma opção para continuar.";
      case "value":
        if (a.valuePoints.length === 0)
          return "Selecione ao menos uma opção (ou indique que não identifica um destaque).";
        if (a.valuePoints.includes("other") && !a.valuePointsOther.trim())
          return "Escreva qual é o outro ponto para continuar.";
        return null;
      case "improve":
        if (a.improvePoints.length === 0)
          return "Selecione ao menos uma opção (ou indique que não identificou um problema).";
        if (a.improvePoints.includes("other") && !a.improvePointsOther.trim())
          return "Escreva qual é o outro ponto para continuar.";
        return null;
      case "improveDetail":
        return a.improveDetail.trim()
          ? null
          : "Conte em ao menos uma frase o que aconteceu para continuar.";
      case "support":
        if (!a.supportOutcome) return "Escolha o resultado do seu atendimento mais recente.";
        if (a.supportEase === null) return "Escolha um valor de 1 a 5 para continuar.";
        return null;
      case "failure":
        if (!a.failureFactor) return "Escolha o fator que mais contribuiu.";
        if (a.failureFactor === "other" && !a.failureFactorOther.trim())
          return "Conte o que aconteceu para continuar.";
        return null;
      case "transition":
        return a.realAccountTransition ? null : "Escolha uma opção para continuar.";
      case "withdrawal":
        if (!a.withdrawalExperience) return "Escolha uma opção para continuar.";
        if (
          withdrawalProblemValues.has(a.withdrawalExperience) &&
          !a.withdrawalDetail.trim()
        )
          return "Conte o que aconteceu com o seu saque para continuar.";
        return null;
      case "trust":
        return a.trustScore === null ? "Escolha uma nota de 0 a 10 para continuar." : null;
      case "communication":
        return a.communication ? null : "Escolha uma opção para continuar.";
      case "contents":
        return a.desiredContents.length > 0
          ? null
          : "Selecione ao menos uma opção para continuar.";
      case "repurchase":
        return a.repurchaseIntent ? null : "Escolha uma opção para continuar.";
      case "barrier":
        if (a.repurchaseBarrier.length === 0)
          return "Selecione ao menos uma opção para continuar.";
        if (a.repurchaseBarrier.includes("other") && !a.repurchaseBarrierOther.trim())
          return "Conte o que pesa nessa decisão para continuar.";
        return null;
      case "priority":
        if (!a.priorityFix) return "Escolha uma opção para continuar.";
        if (a.priorityFix === "other" && !a.priorityFixOther.trim())
          return "Escreva o que deveria ser corrigido para continuar.";
        return null;
      default:
        return null; // etapas opcionais
    }
  };

  const submit = async () => {
    if (!draft || submitState === "sending") return;
    setSubmitState("sending");
    setError(null);
    const utms = getStoredUtms();
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseId: draft.id,
          answers: draft.answers,
          customerRef,
          elapsedMs: Date.now() - draft.startedAt,
          referrer: draft.referrer,
          website: honeypot, // honeypot — humanos nunca preenchem
          utm_source: utms.utm_source ?? "",
          utm_medium: utms.utm_medium ?? "",
          utm_campaign: utms.utm_campaign ?? "",
          utm_content: utms.utm_content ?? "",
          utm_term: utms.utm_term ?? "",
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(`status ${res.status}`);
      }
      // Sucesso confirmado pelo servidor: limpa o rascunho e marca o envio.
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.setItem(DONE_KEY, new Date().toISOString());
      } catch {
        // sem storage, apenas segue
      }
      onDone();
    } catch {
      setSubmitState("failed");
      setError(
        "Não foi possível enviar agora. Suas respostas estão guardadas neste dispositivo — verifique a conexão e tente novamente."
      );
      return;
    }
    setSubmitState("idle");
  };

  const advance = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    if (isLast) {
      void submit();
      return;
    }
    goTo(stepIndex + 1);
  };

  if (!draft) {
    // Um frame até hidratar o rascunho — evita flash de conteúdo errado.
    return <div className="min-h-[320px]" aria-hidden="true" />;
  }

  const a = answers;

  return (
    <div>
      {/* Progresso */}
      <div className="mb-8">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="np-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ap-text-dim)]">
            Pergunta {String(stepIndex + 1).padStart(2, "0")}{" "}
            <span aria-hidden="true">/</span>
            <span className="sr-only">de</span>{" "}
            {String(steps.length).padStart(2, "0")}
          </span>
          <span
            className="np-mono text-[11px] text-[var(--ap-green-hover)]"
            aria-hidden="true"
          >
            {Math.round(((stepIndex + 1) / steps.length) * 100)}%
          </span>
        </div>
        <div
          className="np-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
          aria-label="Progresso da pesquisa"
        >
          <div
            className="np-progress-fill"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Âncora de foco/rolagem da etapa */}
      <div
        ref={stepTopRef}
        tabIndex={-1}
        className="outline-none scroll-mt-28"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          advance();
        }}
        noValidate
      >
        {/* Honeypot invisível (proteção anti-bot sem atrito) */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="np-website">Não preencha este campo</label>
          <input
            id="np-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div key={step} className="np-step-enter">
          <p className="np-eyebrow mb-4 text-[10px] text-[var(--ap-text-dim)]">
            {SECTION_OF[step]}
          </p>
          {step === "identity" && (
            <QuestionBlock
              title="Antes de começar, quem é você?"
              hint="Usamos esses dados apenas para ligar a resposta à sua conta e, se for o caso, resolver o que você relatar."
            >
              <div className="grid gap-4">
                <ShortText
                  id="np-respondent-name"
                  label="Nome"
                  value={a.respondentName}
                  onChange={(v) => update({ respondentName: v })}
                  required
                  autoComplete="name"
                  placeholder="Seu nome"
                />
                <ShortText
                  id="np-respondent-email"
                  label="E-mail"
                  value={a.respondentEmail}
                  onChange={(v) => update({ respondentEmail: v })}
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                />
                <ShortText
                  id="np-respondent-whatsapp"
                  label="WhatsApp"
                  value={a.respondentWhatsapp}
                  onChange={(v) => update({ respondentWhatsapp: v })}
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="(11) 90000-0000"
                />
              </div>
            </QuestionBlock>
          )}
          {step === "nps" && (
            <QuestionBlock title="Em uma escala de 0 a 10, qual é a probabilidade de você recomendar a Neoprop a um amigo ou colega trader?">
              <ScaleInput
                name="nps"
                min={0}
                max={10}
                value={a.npsScore}
                onChange={(v) => update({ npsScore: v })}
                minLabel="Não recomendaria"
                maxLabel="Recomendaria com certeza"
              />
            </QuestionBlock>
          )}

          {step === "npsReason" && a.npsScore !== null && (
            <QuestionBlock
              title={npsReasonQuestion(a.npsScore)}
              hint="Se puder, conte em uma frase. (Opcional)"
            >
              <OpenText
                id="np-nps-reason"
                value={a.npsReason}
                onChange={(v) => update({ npsReason: v })}
                placeholder="Escreva aqui, do seu jeito."
              />
            </QuestionBlock>
          )}

          {step === "journey" && (
            <QuestionBlock title="Pensando na sua experiência mais recente, qual opção melhor descreve o momento em que você está?">
              <SingleChoice
                name="journey"
                options={journeyStages}
                value={a.journeyStage}
                onChange={(v) => {
                  // Poda seleções de temas que a nova jornada não exibe mais
                  const allowedValue = valueOptions(v).map((o) => o.value);
                  const allowedImprove = improveOptions(v).map((o) => o.value);
                  update({
                    journeyStage: v,
                    journeyStageSource: "form",
                    valuePoints: a.valuePoints.filter((p) => allowedValue.includes(p)),
                    improvePoints: a.improvePoints.filter((p) => allowedImprove.includes(p)),
                  });
                }}
              />
            </QuestionBlock>
          )}

          {step === "origin" && (
            <QuestionBlock title="Como aconteceu o seu primeiro contato com a Neoprop?">
              <SingleChoice
                name="origin"
                options={firstContacts}
                value={a.firstContact}
                onChange={(v) => update({ firstContact: v, firstContactDetail: "" })}
              />
              {firstContactDetailLabel[a.firstContact] && (
                <div className="mt-5">
                  <OpenText
                    id="np-origin-detail"
                    label={
                      a.firstContact === "other"
                        ? firstContactDetailLabel[a.firstContact]
                        : `${firstContactDetailLabel[a.firstContact]} (Opcional)`
                    }
                    value={a.firstContactDetail}
                    onChange={(v) => update({ firstContactDetail: v })}
                    required={a.firstContact === "other"}
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "otherFirms" && (
            <QuestionBlock title="Além da Neoprop, você já comprou um plano de outra mesa proprietária?">
              <SingleChoice
                name="otherFirms"
                options={[
                  { value: "yes", label: "Sim" },
                  { value: "no", label: "Não, a Neoprop foi minha primeira mesa proprietária" },
                ]}
                value={a.otherFirms}
                onChange={(v) =>
                  update({ otherFirms: v as "yes" | "no", otherFirmsNames: "" })
                }
              />
              {a.otherFirms === "yes" && (
                <div className="mt-5">
                  <OpenText
                    id="np-other-firms"
                    label="Em qual ou quais mesas proprietárias você já comprou?"
                    value={a.otherFirmsNames}
                    onChange={(v) => update({ otherFirmsNames: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "tradeMotivation" && (
            <QuestionBlock
              title="O que mais pesou na sua decisão de começar no trade?"
              hint="Selecione o principal motivo."
            >
              <SingleChoice
                name="tradeMotivation"
                options={tradeMotivations}
                value={a.tradeMotivation}
                onChange={(v) => update({ tradeMotivation: v, tradeMotivationOther: "" })}
              />
              {a.tradeMotivation === "other" && (
                <div className="mt-5">
                  <OpenText
                    id="np-trade-other"
                    label="Qual foi o principal motivo?"
                    value={a.tradeMotivationOther}
                    onChange={(v) => update({ tradeMotivationOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "deskMotivations" && (
            <QuestionBlock
              title="Quais foram os principais motivos que levaram você a operar por meio de uma mesa proprietária?"
              hint="Você pode selecionar mais de uma opção."
            >
              <MultiChoice
                name="deskMotivations"
                options={deskMotivations}
                values={a.deskMotivations}
                onChange={(v) => update({ deskMotivations: v })}
              />
              {a.deskMotivations.includes("other") && (
                <div className="mt-5">
                  <OpenText
                    id="np-desk-other"
                    label="O que também levou você a escolher uma mesa proprietária?"
                    value={a.deskMotivationsOther}
                    onChange={(v) => update({ deskMotivationsOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "expectation" && (
            <QuestionBlock title="Comparando com o que você esperava antes de comprar, até aqui a sua experiência ficou:">
              <SingleChoice
                name="expectation"
                options={expectations}
                value={a.expectation}
                onChange={(v) => update({ expectation: v })}
              />
            </QuestionBlock>
          )}

          {step === "value" && (
            <QuestionBlock
              title="Em quais pontos a Neoprop mais entregou valor para você?"
              hint="Escolha até dois."
            >
              <MultiChoice
                name="value"
                options={valueOptions(a.journeyStage)}
                values={a.valuePoints}
                onChange={(v) => update({ valuePoints: v })}
                max={2}
                exclusiveValues={[VALUE_NONE]}
              />
              {a.valuePoints.includes("other") && (
                <div className="mt-5">
                  <OpenText
                    id="np-value-other"
                    label="Qual outro ponto?"
                    value={a.valuePointsOther}
                    onChange={(v) => update({ valuePointsOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "improve" && (
            <QuestionBlock
              title="Em quais pontos a Neoprop mais precisa melhorar?"
              hint="Escolha até três."
            >
              <MultiChoice
                name="improve"
                options={improveOptions(a.journeyStage)}
                values={a.improvePoints}
                onChange={(v) => update({ improvePoints: v, improveDetail: "" })}
                max={3}
                exclusiveValues={[IMPROVE_NONE]}
              />
              {a.improvePoints.includes("other") && (
                <div className="mt-5">
                  <OpenText
                    id="np-improve-other"
                    label="Qual outro ponto?"
                    value={a.improvePointsOther}
                    onChange={(v) => update({ improvePointsOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "improveDetail" && (
            <QuestionBlock
              title={`Você marcou "${themeLabel(criticalTheme(a.improvePoints) ?? "")}". O que aconteceu ou o que deveria ser diferente?`}
              hint="Conte em uma ou duas frases — é isso que orienta a correção."
            >
              <OpenText
                id="np-improve-detail"
                value={a.improveDetail}
                onChange={(v) => update({ improveDetail: v })}
                placeholder="Conte o que aconteceu."
                required
              />
            </QuestionBlock>
          )}

          {step === "support" && (
            <div className="grid gap-10">
              <QuestionBlock title="Pensando no seu atendimento mais recente, qual foi o resultado?">
                <SingleChoice
                  name="supportOutcome"
                  options={supportOutcomes}
                  value={a.supportOutcome}
                  onChange={(v) => update({ supportOutcome: v })}
                />
              </QuestionBlock>
              <QuestionBlock title="Resolver minha solicitação com a Neoprop foi fácil.">
                <ScaleInput
                  name="supportEase"
                  min={1}
                  max={5}
                  value={a.supportEase}
                  onChange={(v) => update({ supportEase: v })}
                  minLabel="Discordo totalmente"
                  maxLabel="Concordo totalmente"
                />
              </QuestionBlock>
            </div>
          )}

          {step === "failure" && (
            <QuestionBlock title="Na sua experiência mais recente, qual fator mais contribuiu para a reprovação ou para o abandono?">
              <SingleChoice
                name="failure"
                options={failureFactors}
                value={a.failureFactor}
                onChange={(v) => update({ failureFactor: v, failureFactorOther: "" })}
              />
              {a.failureFactor === "other" && (
                <div className="mt-5">
                  <OpenText
                    id="np-failure-other"
                    label="Conte o que aconteceu."
                    value={a.failureFactorOther}
                    onChange={(v) => update({ failureFactorOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "transition" && (
            <QuestionBlock title="Como você avalia a transição entre a aprovação e o início da conta real?">
              <SingleChoice
                name="transition"
                options={transitions}
                value={a.realAccountTransition}
                onChange={(v) => update({ realAccountTransition: v })}
              />
            </QuestionBlock>
          )}

          {step === "withdrawal" && (
            <QuestionBlock title="Pensando na sua solicitação de saque mais recente, qual opção melhor descreve sua experiência?">
              <SingleChoice
                name="withdrawal"
                options={withdrawalExperiences}
                value={a.withdrawalExperience}
                onChange={(v) => update({ withdrawalExperience: v, withdrawalDetail: "" })}
              />
              {withdrawalProblemValues.has(a.withdrawalExperience) && (
                <div className="mt-5">
                  <OpenText
                    id="np-withdrawal-detail"
                    label="O que aconteceu?"
                    value={a.withdrawalDetail}
                    onChange={(v) => update({ withdrawalDetail: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "trust" && (
            <QuestionBlock title="Hoje, quanto você confia que a Neoprop cumpre o que comunica?">
              <ScaleInput
                name="trust"
                min={0}
                max={10}
                value={a.trustScore}
                onChange={(v) => update({ trustScore: v })}
                minLabel="Não confio"
                maxLabel="Confio completamente"
              />
            </QuestionBlock>
          )}

          {step === "communication" && (
            <QuestionBlock title="Pensando nas mensagens, lives, campanhas e ofertas da Neoprop nos últimos 60 dias, qual opção mais representa sua experiência?">
              <SingleChoice
                name="communication"
                options={communications}
                value={a.communication}
                onChange={(v) => update({ communication: v })}
              />
            </QuestionBlock>
          )}

          {step === "contents" && (
            <QuestionBlock
              title="O que você realmente gostaria de receber da Neoprop?"
              hint="Escolha até três."
            >
              <MultiChoice
                name="contents"
                options={desiredContents}
                values={a.desiredContents}
                onChange={(v) => update({ desiredContents: v })}
                max={3}
                exclusiveValues={[NO_MARKETING]}
              />
            </QuestionBlock>
          )}

          {step === "repurchase" && (
            <QuestionBlock title="Se decidisse adquirir uma nova conta proprietária hoje, qual cenário mais se aproxima do que você faria?">
              <SingleChoice
                name="repurchase"
                options={repurchaseIntents}
                value={a.repurchaseIntent}
                onChange={(v) =>
                  update({
                    repurchaseIntent: v,
                    repurchaseBarrier: [],
                    repurchaseBarrierOther: "",
                  })
                }
              />
            </QuestionBlock>
          )}

          {step === "barrier" && (
            <QuestionBlock title="O que mais pesa nessa decisão?" hint="Escolha até três.">
              <MultiChoice
                name="barrier"
                options={repurchaseBarriers}
                values={a.repurchaseBarrier}
                onChange={(v) => update({ repurchaseBarrier: v })}
                max={3}
              />
              {a.repurchaseBarrier.includes("other") && (
                <div className="mt-5">
                  <OpenText
                    id="np-barrier-other"
                    label="Conte o que pesa."
                    value={a.repurchaseBarrierOther}
                    onChange={(v) => update({ repurchaseBarrierOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "priority" && (
            <QuestionBlock
              title="Se a Neoprop pudesse corrigir ou melhorar apenas uma coisa nos próximos 30 dias, o que deveria ser?"
              hint="Escolha uma opção."
            >
              <SingleChoice
                name="priority"
                options={priorityOptions(a.journeyStage)}
                value={a.priorityFix}
                onChange={(v) => update({ priorityFix: v, priorityFixOther: "" })}
              />
              {a.priorityFix === "other" && (
                <div className="mt-5">
                  <OpenText
                    id="np-priority-other"
                    label="O que deveria ser?"
                    value={a.priorityFixOther}
                    onChange={(v) => update({ priorityFixOther: v })}
                    required
                  />
                </div>
              )}
            </QuestionBlock>
          )}

          {step === "preserve" && (
            <QuestionBlock
              title="Existe algo que a Neoprop faz bem e não deveria mudar de jeito nenhum?"
              hint="(Opcional)"
            >
              <OpenText
                id="np-preserve"
                value={a.preserve}
                onChange={(v) => update({ preserve: v })}
                placeholder="Escreva aqui."
              />
            </QuestionBlock>
          )}

        </div>

        {/* Erro de validação/envio */}
        <div aria-live="polite" className="min-h-6 mt-5">
          {error && (
            <p className="text-sm font-medium text-[var(--ap-red)]">{error}</p>
          )}
        </div>

        {/* Navegação */}
        <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={() => goTo(stepIndex - 1)}
            disabled={stepIndex === 0 || submitState === "sending"}
            className={stepIndex === 0 ? "invisible" : ""}
          >
            Voltar
          </Button>
          <Button
            type="submit"
            size="md"
            loading={submitState === "sending"}
            className="sm:min-w-44"
          >
            {isLast
              ? submitState === "failed"
                ? "Tentar enviar novamente"
                : "Enviar respostas"
              : "Continuar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
