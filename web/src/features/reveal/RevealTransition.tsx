"use client";

import { useEffect, useRef, useState } from "react";

/** Momento da revelação: tela escura, "revelando…" e depois a chamada para ver as fotos. Sem sombras nem gradientes. */
export function RevealTransition({ title, onClose }: { title: string; onClose: () => void }) {
  const [done, setDone] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setDone(true), reduce ? 0 : 2200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (done) btn.current?.focus();
  }, [done]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Revelação das fotos" data-testid="transicao-revelacao" className="app-reveal">
      <div className="app-reveal-inner">
        <p className="eyebrow" style={{ margin: 0, opacity: 0.8 }}>{title}</p>
        <p className="emocao-lg" style={{ margin: 0 }} aria-live="polite">{done ? "O filme foi revelado." : "Revelando…"}</p>
        <div className="app-reveal-frame" aria-hidden="true"><span className={done ? "app-reveal-bar app-reveal-bar--done" : "app-reveal-bar"} /></div>
        {done && (
          <button ref={btn} type="button" className="mm-btn mm-btn--cta mm-btn--bloco" style={{ background: "var(--fundo)", color: "var(--tinta)" }} onClick={onClose}>Ver as fotos</button>
        )}
      </div>
    </div>
  );
}
