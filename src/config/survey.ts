/**
 * Configuração da pesquisa de experiência Neoprop (rota /pesquisa).
 *
 * O vídeo é substituível sem tocar em componente algum: troque provider/src
 * aqui (ou defina as variáveis NEXT_PUBLIC_SURVEY_VIDEO_* no ambiente).
 *
 *  - provider "html5":  src é a URL direta do arquivo .mp4/.webm;
 *  - provider "youtube": src é o ID do vídeo (ex.: "dQw4w9WgXcQ");
 *  - provider "vimeo":   src é o ID numérico do vídeo;
 *  - provider "embed":   src é a URL completa do iframe (Panda, Wistia etc.).
 *
 * Sem src configurado, a página mostra um cartão de fallback e a pesquisa
 * segue disponível normalmente (o vídeo nunca condiciona o acesso).
 */

export type SurveyVideoProvider = "html5" | "youtube" | "vimeo" | "embed";

export const surveyConfig = {
  video: {
    provider: (process.env.NEXT_PUBLIC_SURVEY_VIDEO_PROVIDER ||
      "html5") as SurveyVideoProvider,
    src: process.env.NEXT_PUBLIC_SURVEY_VIDEO_SRC || "",
    /** Imagem de capa (poster). Opcional; caminho público ou URL. */
    poster: process.env.NEXT_PUBLIC_SURVEY_VIDEO_POSTER || "",
    durationLabel: "1 min 30 s",
  },
  /** Destino do botão discreto da tela final. */
  backUrl: process.env.NEXT_PUBLIC_SURVEY_BACK_URL || "https://neoprop.com.br",
  /** Tempo médio exibido na introdução. */
  averageTimeLabel: "3 minutos",
} as const;
