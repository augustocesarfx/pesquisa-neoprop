"use client";

/**
 * Experiência completa da pesquisa Neoprop:
 * introdução (identificação, headline, vídeo, transição) → formulário
 * progressivo → tela final. Sem oferta, preço, contador ou CTA comercial
 * em nenhuma fase.
 *
 * Parâmetros de URL suportados (todos opcionais):
 *  - stage: estágio da jornada vindo do CRM (valores de journeyStages) —
 *    quando presente e válido, a pergunta 3 não é exibida;
 *  - cid | email: identificação do cliente vinda do CRM — quando presente,
 *    os dados de contato não são solicitados novamente;
 *  - utm_*: preservados pela lib compartilhada (localStorage + cookie).
 */

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { captureUtms } from "@/lib/utm";
import { surveyConfig } from "@/config/survey";
import { journeyStages } from "./survey-data";
import { NeopropLogo } from "./NeopropLogo";
import { SurveyVideo } from "./SurveyVideo";
import { SurveyWizard, DONE_KEY, DRAFT_KEY } from "./SurveyWizard";

type Phase = "loading" | "intro" | "survey" | "done";

export function SurveyExperience() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [urlStage, setUrlStage] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [prefill, setPrefill] = useState({ name: "", email: "", whatsapp: "" });

  useEffect(() => {
    captureUtms();

    const params = new URLSearchParams(window.location.search);

    const stageParam = params.get("stage") ?? "";
    if (journeyStages.some((s) => s.value === stageParam)) {
      setUrlStage(stageParam);
    }

    const cid = (params.get("cid") ?? "").trim().slice(0, 120);
    const email = (params.get("email") ?? "").trim().slice(0, 200);

    // Pré-preenche a identificação quando o disparo (CRM) traz os dados
    setPrefill({
      name: (params.get("nome") ?? params.get("name") ?? "").trim().slice(0, 200),
      email,
      whatsapp: (params.get("whatsapp") ?? params.get("tel") ?? "")
        .trim()
        .slice(0, 30),
    });
    const ref = cid ? `cid:${cid}` : email ? `email:${email}` : "";
    if (ref) {
      setCustomerRef(ref);
      try {
        sessionStorage.setItem("np_survey_ref", ref);
      } catch {
        // sem storage, segue sem retomada da identificação
      }
    } else {
      try {
        const stored = sessionStorage.getItem("np_survey_ref");
        if (stored) setCustomerRef(stored);
      } catch {
        // idem
      }
    }

    // Já enviou → agradecimento; rascunho em andamento → retoma direto o
    // formulário (a atualização acidental da página não volta à introdução).
    let alreadyDone = false;
    let hasDraft = false;
    try {
      alreadyDone = Boolean(localStorage.getItem(DONE_KEY));
      hasDraft = Boolean(localStorage.getItem(DRAFT_KEY));
    } catch {
      // sem storage, começa da introdução
    }
    setPhase(alreadyDone ? "done" : hasDraft ? "survey" : "intro");
  }, []);

  const start = () => {
    setPhase("survey");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <main className="np-page min-h-screen">
      {phase === "loading" && <div className="min-h-screen" aria-hidden="true" />}

      {phase === "intro" && (
        <Intro onStart={start} />
      )}

      {phase === "survey" && (
        <section className="py-14 md:py-20" aria-label="Pesquisa de experiência">
          <Container narrow className="max-w-2xl">
            <div className="mb-10 flex items-center gap-4">
              <NeopropLogo className="h-9 w-auto md:h-10" />
              <span
                className="h-6 w-px bg-[var(--ap-border-strong)]"
                aria-hidden="true"
              />
              <p className="np-eyebrow text-[10px] md:text-xs text-[var(--ap-text-dim)]">
                Pesquisa de Experiência
              </p>
            </div>
            <SurveyWizard
              customerRef={customerRef}
              urlStage={urlStage}
              prefill={prefill}
              onDone={() => {
                setPhase("done");
                window.scrollTo({ top: 0, behavior: "auto" });
              }}
            />
          </Container>
        </section>
      )}

      {phase === "done" && <ThankYou />}

      <footer className="border-t border-[var(--ap-border)] py-8">
        <Container narrow>
          <NeopropLogo className="mx-auto mb-4 h-6 w-auto opacity-70" />
          <p className="text-center text-xs leading-relaxed text-[var(--ap-text-dim)]">
            Suas respostas são coletadas apenas para orientar melhorias na
            experiência dos clientes da Neoprop. Coletamos somente o necessário
            e a autorização de retorno não é usada para abordagem comercial.
          </p>
        </Container>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <>
      {/* Abertura: grid técnico, sequência orquestrada e linha de pulso */}
      <section
        className="np-dark relative overflow-hidden"
        aria-label="Apresentação da pesquisa"
      >
        <div className="np-hero-grid" aria-hidden="true" />
        <div className="np-hero-glow" aria-hidden="true" />
        <Container narrow className="relative max-w-3xl pt-14 pb-4 md:pt-20 md:pb-6 text-center">
          <div className="np-rise">
            <NeopropLogo className="mx-auto h-12 w-auto md:h-14" />
          </div>
          <p
            className="np-eyebrow np-rise mt-7 text-[10px] md:text-xs text-[var(--ap-text-dim)]"
            style={{ animationDelay: "0.1s" }}
          >
            Pesquisa de Experiência Neoprop
          </p>
          <h1
            className="np-display np-rise mt-6 text-balance text-[2rem] leading-[1.08] md:text-5xl"
            style={{ animationDelay: "0.2s" }}
          >
            Você fez parte da nossa história. Agora,{" "}
            <span className="text-[var(--ap-green-hover)]">sua voz</span>{" "}
            precisa fazer parte do próximo capítulo.
          </h1>
          <p
            className="np-rise mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-[var(--ap-text-dim)] md:text-lg"
            style={{ animationDelay: "0.32s" }}
          >
            Em apenas três minutos, conte o que te surpreendeu, o que te
            frustrou e o que precisa mudar para construirmos uma Neoprop mais
            segura, simples e próxima do trader.
          </p>
          {/* Assinatura: curva de capital que se desenha — o pulso de quem opera */}
          <div className="np-rise mt-2" style={{ animationDelay: "0.42s" }}>
            <PulseLine />
          </div>
        </Container>
      </section>

      {/* Vídeo */}
      <section className="bg-[var(--ap-bg)] py-14 md:py-20" aria-label="Mensagem em vídeo">
        <Container narrow className="max-w-3xl">
          <Reveal>
            <SurveyVideo />
          </Reveal>
        </Container>
      </section>

      {/* Transição para a pesquisa */}
      <section
        className="bg-[var(--ap-bg-2)] py-16 md:py-24"
        aria-label="Começar a pesquisa"
      >
        <Container narrow className="max-w-2xl text-center">
          <Reveal>
            <h2 className="np-display text-balance text-2xl leading-snug md:text-4xl">
              Agora queremos ouvir você.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-balance leading-relaxed text-[var(--ap-text-dim)]">
              Não existem respostas certas. Críticas, frustrações e experiências
              negativas são tão importantes quanto os pontos positivos.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <ul className="mx-auto mt-10 grid max-w-md gap-3 text-left text-sm md:text-[0.95rem]">
              {[
                `Tempo médio: aproximadamente ${surveyConfig.averageTimeLabel}`,
                "As respostas serão utilizadas para orientar melhorias reais",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-[var(--ap-border-strong)] bg-[var(--ap-surface)] px-4 py-3.5"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-0.5 size-4 flex-none text-[var(--ap-green)]"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8.4 6.5 12 13 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-10">
              <Button onClick={onStart} className="w-full max-w-sm md:w-auto md:px-12">
                Começar pesquisa
              </Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

/** Curva de capital estilizada que se desenha no carregamento do hero. */
function PulseLine() {
  return (
    <svg
      viewBox="0 0 640 96"
      className="mx-auto h-16 w-full max-w-xl md:h-20"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="np-pulse-line"
        pathLength={1000}
        d="M8 78 C 60 74, 92 80, 128 68 S 190 42, 226 52 S 282 70, 318 54 S 372 22, 410 34 S 466 52, 502 36 S 570 12, 616 18"
        stroke="var(--ap-green)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle
        className="np-pulse-dot"
        cx="616"
        cy="18"
        r="4"
        fill="var(--ap-green-hover)"
        style={{ transformOrigin: "616px 18px" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function ThankYou() {
  return (
    <section className="py-20 md:py-32" aria-label="Pesquisa concluída">
      <Container narrow className="max-w-2xl text-center">
        <NeopropLogo className="mx-auto mb-10 h-10 w-auto" />
        <svg viewBox="0 0 100 100" className="mx-auto size-16" aria-hidden="true">
          <circle
            className="np-seal-circle"
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--ap-border-strong)"
            strokeWidth="1.5"
          />
          <path
            className="np-seal-check"
            d="M32 52 45 65 70 38"
            fill="none"
            stroke="var(--ap-green)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="np-display mt-8 text-balance text-3xl leading-tight md:text-4xl">
          Obrigado por falar com sinceridade.
        </h1>
        <div className="mx-auto mt-6 max-w-xl text-balance leading-relaxed text-[var(--ap-text-dim)]">
          <p>
            Sua resposta será analisada pela nossa equipe e fará parte das
            decisões sobre o que a Neoprop precisa corrigir, preservar e
            construir daqui para frente.
          </p>
        </div>
        <div className="mt-12">
          <a
            href={surveyConfig.backUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--ap-border-strong)] px-6 py-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--ap-text-dim)] transition-colors hover:border-[var(--ap-green)] hover:text-[var(--ap-text)]"
          >
            Voltar para a Neoprop
          </a>
        </div>
      </Container>
    </section>
  );
}
