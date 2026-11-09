"use client";
/* Casca comum dos passos do assistente "Montar a câmera" (Camera-*.html): grab, título + n/8, barra de passos, corpo e barra de ação. Mesmo markup da referência. */
import type { ReactNode } from "react";

const BACK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export function WizardSheet({ step, title, caption, children, next = "Próximo", onBack, onNext, busy }: {
  step: number; title: string; caption: string; children: ReactNode; next?: string; onBack?: () => void; onNext?: () => void; busy?: boolean;
}) {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full">
        <div className="rv-sheet__grab" />
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="rv-title">{title}</h1>
            <p className="rv-caption" style={{ marginTop: "4px", maxWidth: "290px" }}>{caption}</p>
          </div>
          <span className="rv-stamp" style={{ fontSize: "12px", marginTop: "6px" }} aria-label={`Passo ${step} de 8`}>{step}/8</span>
        </div>
        <div className="rv-steps">
          {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < step ? "on" : ""} />)}
        </div>
        <div className="sheet-body">{children}</div>
        <div className="cta-bar">
          <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack} disabled={busy}>{BACK}</button>
          <button type="button" className="rv-btn rv-btn--primary" onClick={onNext} disabled={busy} aria-busy={busy}>{next}</button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
