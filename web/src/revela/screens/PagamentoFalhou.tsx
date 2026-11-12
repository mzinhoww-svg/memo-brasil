"use client";
/* Gerado de design-system/revela/html/Pagamento-falhou.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import { useRef } from "react";
import { stampSlam } from "@/lib/motion/revela-motion";
import { useMomentOnce } from "@/lib/motion/use-moments";

export interface PagamentoFalhouProps { title?: string; message?: string; stamp?: string; primary?: string; secondary?: string | null; onClose?: () => void; onPrimary?: () => void; onSecondary?: () => void }

export function PagamentoFalhou({ title = "O banco recusou", message = "O cartão final 4417 não foi aprovado. Nada foi cobrado. Tente com Pix ou com outro cartão.", stamp = "RECUSADO", primary = "Pagar com Pix", secondary = "Usar outro cartão", onClose, onPrimary, onSecondary }: PagamentoFalhouProps = {}) {
  const mark = useRef<HTMLSpanElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  // recusado ou expirado: o carimbo bate no papel (sem confete)
  useMomentOnce(true, () => { if (mark.current) void stampSlam(mark.current, paper.current ?? undefined); });
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div className="row between" style={{ "alignSelf": "stretch" }}>
          <button type="button" className="rv-icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span />
        </div>
        <div className="failviz">
          <div ref={paper} className="rv-print rv-print--back" style={{ "position": "absolute", "left": "40px", "top": "20px", "width": "170px", "height": "215px", "rotate": "-6deg", "zIndex": "1" }} />
          <span className="failstamp-pos">
            <span ref={mark} className="rv-stamp failstamp" data-testid="carimbo-falha" style={{ visibility: "hidden" }}>
              {stamp}
            </span>
          </span>
        </div>
        <h1 className="rv-title-lg">
          {title}
        </h1>
        <p className="rv-body muted" role="alert" style={{ "margin": "12px 0 0", "maxWidth": "300px" }}>
          {message}
        </p>
        <div className="grow" />
        <div className="stack" style={{ "alignSelf": "stretch" }}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onPrimary}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
            </svg>
            {primary}
          </button>
          {secondary && <button type="button" className="rv-btn rv-btn--block" onClick={onSecondary}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M2.5 10h19M6 15h4" />
            </svg>
            {secondary}
          </button>}
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
