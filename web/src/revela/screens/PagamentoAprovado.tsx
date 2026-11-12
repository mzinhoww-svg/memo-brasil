"use client";
/* Gerado de design-system/revela/html/Pagamento-aprovado.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import { useRef } from "react";
import { confetti, stampSlam } from "@/lib/motion/revela-motion";
import { useMomentOnce } from "@/lib/motion/use-moments";

export interface PagamentoAprovadoProps { cam?: string; message?: string; paid?: string; when?: string; onContinue?: () => void }

export function PagamentoAprovado({ cam = "/revela/ref/cam-casamento.webp", message = "A câmera de Ana & Leo está liberada para 250 convidados, com 36 poses cada.", paid = "Pix · R$ 189,00", when = "hoje, 08:42 · comprovante por e-mail", onContinue }: PagamentoAprovadoProps = {}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stamp = useRef<HTMLHeadingElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  // pago: o carimbo bate no papel e o confete estoura
  useMomentOnce(true, () => {
    if (stamp.current) void stampSlam(stamp.current, paper.current ?? undefined);
    if (canvas.current) void confetti(canvas.current, { mode: "burst", origin: { x: 0.5, y: 0.35 } });
  });
  return (
    <>
    <div className="scr">
      <canvas ref={canvas} className="rvm-fx" aria-hidden="true" data-testid="confete" />
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div style={{ "marginTop": "150px" }}>
          <div className="rv-stagebox" style={{  }}>
            <img src={cam} alt="" style={{ "width": "280px" }} />
          </div>
        </div>
        <h1 ref={stamp} className="rv-display rvm-pago" data-testid="carimbo-pago" style={{ "marginTop": "4px" }}>
          Pago.
        </h1>
        <p className="rv-body muted" style={{ "margin": "10px 0 18px", "maxWidth": "300px" }}>
          {message}
        </p>
        <div ref={paper} className="rv-group">
          <div className="rv-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
            </svg>
            <div className="rv-row__text">
              {paid}
              <span className="rv-row__meta">
                {when}
              </span>
            </div>
            <span className="rv-row__end" style={{ "color": "var(--success)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
          </div>
        </div>
        <div className="grow" />
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onContinue}>
          Ver a câmera pronta
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
