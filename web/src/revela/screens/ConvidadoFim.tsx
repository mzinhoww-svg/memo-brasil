"use client";
/* Convidado-fim.html (24): o filme acabou. Serve também para "A câmera fechou" (festa encerrada) e, depois da revelação, leva ao feed. */
import Link from "next/link";
import type { ReactNode } from "react";
import { Odo } from "../Odo";

export interface ConvidadoFimProps {
  /** Fotos que a pessoa tirou (texto "Suas 27 fotos …"). */
  taken?: number;
  /** Festa encerrada: sem contador de poses e com o título "A câmera fechou". */
  ended?: boolean;
  /** As fotos já foram reveladas: o botão leva ao feed. */
  revealed?: boolean;
  /** Tempo até a revelação em ms; `null`/0 oculta o relógio. */
  remainingMs?: number | null;
  /** Aviso do aparelho ligado: mostra a linha do sino. */
  notify?: boolean;
  /** Texto do app no lugar do parágrafo do desenho. */
  body?: ReactNode;
  closeHref?: string;
  feedHref?: string;
  onClose?: () => void;
  /** Contador para leitores de tela / testes. */
  children?: ReactNode;
}


export function ConvidadoFim({ taken = 27, ended, revealed, remainingMs = 13 * 3_600_000 + 42 * 60_000 + 8_000, notify = true, body, closeHref, feedHref, onClose, children }: ConvidadoFimProps = {}) {
  const ms = Math.max(0, remainingMs ?? 0);
  const hh = Math.floor(ms / 3_600_000), mm = Math.floor((ms % 3_600_000) / 60_000), ss = Math.floor((ms % 60_000) / 1000);
  const x = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "textAlign": "center", "alignItems": "center" }}>
        <div className="row between" style={{ "alignSelf": "stretch" }}>
          {closeHref
            ? <Link href={closeHref} className="rv-icon-btn" aria-label="Fechar">{x}</Link>
            : <button type="button" className="rv-icon-btn" aria-label="Fechar" onClick={onClose}>{x}</button>}
          <span />
        </div>
        <div className="stackviz">
          <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "40px", "top": "30px", "width": "170px", "height": "215px", "transform": "rotate(-9deg)", "zIndex": "1" }} />
          <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "100px", "top": "10px", "width": "170px", "height": "215px", "transform": "rotate(4deg)", "zIndex": "2" }} />
          <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "70px", "top": "50px", "width": "170px", "height": "215px", "transform": "rotate(-2deg)", "zIndex": "3" }} />
        </div>
        {!ended && (
          <div className="rv-counter" style={{ "margin": "6px 0 18px" }}>
            <Odo value={0} padText />
            <span>
              poses restantes
            </span>
          </div>
        )}
        <h1 className="rv-title-lg">
          {ended ? "A câmera fechou" : "Seu filme acabou"}
        </h1>
        <p className="rv-body muted" style={{ "margin": "12px 0 0", "maxWidth": "300px" }}>
          {body ?? `Suas ${taken} fotos estão no laboratório. Quando todas forem reveladas, você recebe um aviso e elas entram no feed do evento.`}
        </p>
        <div className="grow" />
        {!revealed && ms > 0 && (
          <div className="countdown" role="timer" aria-label={`Revela em ${hh} horas e ${mm} minutos`}>
            <div>
              <Odo value={hh} padText />
              <span>
                horas
              </span>
            </div>
            <div>
              <Odo value={mm} padText />
              <span>
                min
              </span>
            </div>
            <div>
              <Odo value={ss} padText />
              <span>
                seg
              </span>
            </div>
          </div>
        )}
        {!revealed && notify && (
          <div className="row" style={{ "gap": "10px", "marginBottom": "14px" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
            <span className="rv-caption">
              Aviso ligado: você será chamado quando revelar
            </span>
          </div>
        )}
        {revealed && feedHref
          ? <Link href={feedHref} className="rv-btn rv-btn--block rv-btn--primary">Ver o feed</Link>
          : <button type="button" className="rv-btn rv-btn--block" aria-disabled="true">Ver o feed quando abrir</button>}
      </div>
      <div className="home-ind" />
      <div className="grain" />
      {children}
    </div>
    </>
  );
}
