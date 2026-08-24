/**
 * Configuração da pesquisa de experiência Neoprop (rota /pesquisa).
 *
 * O vídeo é substituível sem tocar em componente algum: troque provider/src
 * aqui (ou defina as variáveis NEXT_PUBLIC_SURVEY_VIDEO_* no ambiente).
 *
 *  - provider "vturb":   player VTurb/ConverteAI (ver bloco `vturb` abaixo);
 *  - provider "html5":   src é a URL direta do arquivo .mp4/.webm;
 *  - provider "youtube": src é o ID do vídeo (ex.: "dQw4w9WgXcQ");
 *  - provider "vimeo":   src é o ID numérico do vídeo;
 *  - provider "embed":   src é a URL completa do iframe (Panda, Wistia etc.).
 *
 * Sem src configurado (nos providers que exigem src), a página mostra um
 * cartão de fallback e a pesquisa segue disponível normalmente.
 */

export type SurveyVideoProvider =
  | "vturb"
  | "html5"
  | "youtube"
  | "vimeo"
  | "embed";

export const surveyConfig = {
  video: {
    provider: (process.env.NEXT_PUBLIC_SURVEY_VIDEO_PROVIDER ||
      "vturb") as SurveyVideoProvider,
    src: process.env.NEXT_PUBLIC_SURVEY_VIDEO_SRC || "",
    /** Imagem de capa (poster). Opcional; caminho público ou URL. */
    poster: process.env.NEXT_PUBLIC_SURVEY_VIDEO_POSTER || "",
    durationLabel: "1 min 30 s",
  },

  /**
   * Player VTurb (ConverteAI). O player controla o delay: passados
   * `delaySeconds` de vídeo, ele revela os elementos com a classe `.esconder`
   * (hoje: a seção "Agora queremos ouvir você" + o botão de começar).
   *
   * Para trocar de vídeo basta atualizar playerId/accountId — os dois vêm do
   * snippet de instalação gerado no painel do VTurb.
   */
  vturb: {
    playerId:
      process.env.NEXT_PUBLIC_VTURB_PLAYER_ID || "6a8c376a48dab67a9e6535c4",
    accountId:
      process.env.NEXT_PUBLIC_VTURB_ACCOUNT_ID ||
      "bd3b9d3d-2a97-4054-bee1-41e5b412ae44",
    /** Proporção do placeholder, exatamente como o VTurb entrega no snippet. */
    aspectPaddingTop: "52.760136785539814%",
    /** Segundos de vídeo até liberar os elementos `.esconder`. */
    delaySeconds: 135,
    /**
     * Rede de segurança: se o player.js não carregar (adblock, queda da CDN),
     * libera os `.esconder` mesmo assim depois de N segundos — o vídeo nunca
     * pode trancar o acesso à pesquisa. Use 0 para desativar.
     */
    failsafeSeconds: 20,
  },

  /** Destino do botão discreto da tela final. */
  backUrl: process.env.NEXT_PUBLIC_SURVEY_BACK_URL || "https://neoprop.com.br",
  /** Tempo médio exibido na introdução. */
  averageTimeLabel: "3 minutos",
} as const;
