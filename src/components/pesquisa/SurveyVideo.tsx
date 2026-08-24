"use client";

/**
 * Área de vídeo da pesquisa (≈1 min 30 s).
 *
 * Facade leve: nada de embed no load — o player real só monta no clique.
 * Origem 100% configurável em src/config/survey.ts (ou variáveis
 * NEXT_PUBLIC_SURVEY_VIDEO_*), sem URL espalhada pelo código.
 * Sem src configurado, ou se o arquivo falhar, mostra um cartão de
 * fallback — o vídeo nunca condiciona o acesso à pesquisa.
 */

import { useEffect, useRef, useState } from "react";
import { surveyConfig } from "@/config/survey";
import type { VturbSmartplayerElement } from "@/types/vturb";
import { NeopropLogo } from "./NeopropLogo";

export function SurveyVideo() {
  const { provider, src, poster, durationLabel } = surveyConfig.video;
  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);
  const configured = Boolean(src);

  // O VTurb monta o próprio player e controla o delay dos `.esconder`.
  if (provider === "vturb") return <VturbPlayer />;

  const embedSrc = (() => {
    switch (provider) {
      case "youtube":
        return `https://www.youtube-nocookie.com/embed/${src}?autoplay=1&rel=0&playsinline=1`;
      case "vimeo":
        return `https://player.vimeo.com/video/${src}?autoplay=1`;
      case "embed":
        return src;
      default:
        return "";
    }
  })();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--ap-border-strong)] bg-[var(--ap-tile-dark)] shadow-[var(--ap-shadow-panel)]">
      {/* Reserva 16:9 fixa — zero layout shift */}
      <div className="relative aspect-video w-full">
        {(!configured || failed) && <VideoFallback failed={failed} />}

        {configured && !failed && !activated && (
          <div className="absolute inset-0">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <PosterPattern />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/45 p-6 text-center">
              <NeopropLogo className="h-9 w-auto md:h-11" />
              <span className="np-eyebrow rounded-full border border-white/25 px-3.5 py-1.5 text-[10px] md:text-xs text-white/85">
                Mensagem da Neoprop • {durationLabel}
              </span>
              <button
                type="button"
                onClick={() => setActivated(true)}
                className="group inline-flex cursor-pointer items-center gap-3 rounded-[10px] bg-[var(--ap-green)] py-3 pl-4 pr-6 font-semibold text-[var(--ap-green-ink)] transition-[transform,background-color] duration-200 hover:scale-[1.03] hover:bg-[var(--ap-green-hover)] active:scale-100"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#070a09]/15">
                  <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                    <path d="M4.5 2.5v11l9-5.5-9-5.5Z" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-sm md:text-base">Assistir à mensagem</span>
              </button>
            </div>
          </div>
        )}

        {configured && !failed && activated && provider === "html5" && (
          <video
            className="absolute inset-0 h-full w-full"
            src={src}
            poster={poster || undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            aria-label="Mensagem em vídeo da Neoprop"
          />
        )}

        {configured && !failed && activated && provider !== "html5" && (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={embedSrc}
            title="Mensagem em vídeo da Neoprop"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}

/** Fallback elegante: a pesquisa segue disponível mesmo sem o vídeo. */
function VideoFallback({ failed }: { failed: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <PosterPattern />
      <div className="relative flex flex-col items-center gap-4">
        <NeopropLogo className="h-9 w-auto opacity-90" />
        <span className="np-eyebrow text-[10px] md:text-xs text-white/70">
          Mensagem da Neoprop
        </span>
        <p className="max-w-sm text-balance text-base md:text-lg text-white/90">
          {failed
            ? "O vídeo não pôde ser carregado agora. A pesquisa segue disponível logo abaixo."
            : "O vídeo estará disponível em breve. A pesquisa já está aberta logo abaixo."}
        </p>
      </div>
    </div>
  );
}

/** Textura discreta para a capa quando não há poster configurado. */
function PosterPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="800" height="450" fill="#070a09" />
      <g stroke="rgba(233,240,236,0.05)" strokeWidth="1">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={56 * (i + 1)} x2="800" y2={56 * (i + 1)} />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={62 * (i + 1)} y1="0" x2={62 * (i + 1)} y2="450" />
        ))}
      </g>
      <path
        d="M60 300 C 180 290, 260 250, 360 240 S 560 205, 740 150"
        fill="none"
        stroke="rgba(22,196,99,0.28)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Player VTurb (ConverteAI).
 *
 * Monta o custom element <vturb-smartplayer> e injeta o player.js uma única
 * vez. Quando o player fica pronto, pedimos a ele que revele os elementos
 * `.esconder` (a seção "Agora queremos ouvir você") depois de
 * `delaySeconds` de vídeo assistido — `persist: true` faz o VTurb lembrar,
 * então quem já passou do delay não espera de novo ao recarregar.
 *
 * Se o player.js não carregar (adblock, CDN fora), o failsafe revela a seção
 * assim mesmo: o vídeo nunca pode trancar o acesso à pesquisa.
 */
function VturbPlayer() {
  const {
    playerId,
    accountId,
    aspectPaddingTop,
    delaySeconds,
    failsafeSeconds,
  } = surveyConfig.vturb;
  const playerRef = useRef<VturbSmartplayerElement>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    let ready = false;

    const onReady = () => {
      ready = true;
      player.displayHiddenElements?.(delaySeconds, [".esconder"], {
        persist: true,
      });
    };
    player.addEventListener("player:ready", onReady);

    const scriptSrc = `https://scripts.converteai.net/${accountId}/players/${playerId}/v4/player.js`;
    if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
      const s = document.createElement("script");
      s.src = scriptSrc;
      s.async = true;
      document.head.appendChild(s);
    }

    const failsafe =
      failsafeSeconds > 0
        ? window.setTimeout(() => {
            if (ready) return;
            document
              .querySelectorAll<HTMLElement>(".esconder")
              .forEach((el) => {
                el.style.display = "block";
              });
          }, failsafeSeconds * 1000)
        : 0;

    return () => {
      player.removeEventListener("player:ready", onReady);
      if (failsafe) window.clearTimeout(failsafe);
    };
  }, [accountId, playerId, delaySeconds, failsafeSeconds]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--ap-border-strong)] bg-[var(--ap-tile-dark)] shadow-[var(--ap-shadow-panel)]">
      {/* A proporção vem do próprio placeholder do VTurb — zero layout shift */}
      <vturb-smartplayer
        ref={playerRef}
        id={`vid-${playerId}`}
        style={{ display: "block", margin: "0 auto", width: "100%" }}
      >
        <div
          className="vturb-player-placeholder"
          style={{
            position: "relative",
            width: "100%",
            padding: `${aspectPaddingTop} 0 0`,
            zIndex: 0,
            backgroundColor: "black",
          }}
        />
      </vturb-smartplayer>
    </div>
  );
}
