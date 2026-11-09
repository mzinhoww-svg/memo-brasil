"use client";

import { RevealIntro } from "./RevealIntro";

/** Momento da revelação com o app aberto: a tela "Revelou." (24c) sobre o feed, com as fotos e contagens reais. */
export function RevealTransition({ onClose }: { title?: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Revelação das fotos" data-testid="transicao-revelacao" style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--bg)" }}>
      <RevealIntro stage="revelou" onOpen={onClose} />
    </div>
  );
}
