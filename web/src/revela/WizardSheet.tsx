"use client";
/* Casca comum dos passos do assistente "Montar a câmera" (Camera-*.html): grab, título + n/8, barra de passos, corpo e barra de ação. Mesmo markup da referência. */
import { useEffect, useState, type ReactNode } from "react";
import { useWizardDirection } from "./wizard-motion";

const BACK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export function WizardSheet({ step, title, caption, children, next = "Próximo", onBack, onNext, busy, foot }: {
  step: number; title: string; caption: string; children: ReactNode; next?: string; onBack?: () => void; onNext?: () => void; busy?: boolean;
  /** Texto fixo logo acima da barra de ação (ex.: aviso de aceite); não rola com o corpo e não cobre o botão. */
  foot?: ReactNode;
}) {
  const dir = useWizardDirection();
  // o traço do passo atual enche depois de montar (transição do kit); os anteriores já entram cheios
  const [filled, setFilled] = useState(step - 1);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(step));
    return () => cancelAnimationFrame(id);
  }, [step]);
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
          {Array.from({ length: 8 }, (_, i) => <i key={i} className={`rv-seg${i < step ? " on" : ""}`} data-on={i < filled} />)}
        </div>
        <div className={`sheet-body ${dir ? "rv-step" : "rv-rise"}`} data-dir={dir}>{children}</div>
        {foot && <div className="sheet-foot" style={{ flex: "none", padding: "0 0 10px", textAlign: "center" }}>{foot}</div>}
        <div className="cta-bar">
          <button type="button" className="rv-icon-btn rv-press" aria-label="Voltar" onClick={onBack} disabled={busy}>{BACK}</button>
          <button type="button" className="rv-btn rv-btn--primary rv-press" onClick={onNext} disabled={busy} aria-busy={busy}>{next}</button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
