/**
 * Tipagem do custom element do player VTurb (ConverteAI).
 *
 * O player.js registra <vturb-smartplayer> em runtime; aqui só declaramos o
 * elemento para o JSX e o método que usamos da API (`displayHiddenElements`,
 * que revela seletores depois de N segundos de vídeo assistido).
 */

import type { DetailedHTMLProps, HTMLAttributes } from "react";

export interface VturbSmartplayerElement extends HTMLElement {
  displayHiddenElements?: (
    delaySeconds: number,
    selectors: string[],
    options?: { persist?: boolean },
  ) => void;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "vturb-smartplayer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
