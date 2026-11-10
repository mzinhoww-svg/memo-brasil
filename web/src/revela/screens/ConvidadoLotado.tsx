"use client";
/* Convidado-lotado.html (20f): a câmera lotou. A mesma tela serve para "Esta câmera já fechou" (festa encerrada). */
import Link from "next/link";
import { CameraStage } from "@/components/revela";
import type { CameraStyle } from "@/domain/options";

export interface ConvidadoLotadoProps {
  title?: string;
  wrap?: CameraStyle;
  stamp?: string;
  /** Vagas do evento (texto "Os 30 lugares …"); sem valor, "Os lugares …". */
  capacity?: number | null;
  /** `true`: festa encerrada ("Esta câmera já fechou"), com "Voltar ao início". */
  closed?: boolean;
  poses?: number | null;
  /** Texto do app no lugar do texto do desenho (o app não avisa o anfitrião sozinho). */
  body?: string;
  closeHref?: string;
  /** Destino de "Voltar ao início" (câmera fechada). */
  homeHref?: string;
  onClose?: () => void;
  /** "Tentar de novo" (câmera lotada). */
  onRetry?: () => void;
}

export function ConvidadoLotado({ title = "30 anos do Rafa", wrap = "festa", stamp = "SÁB 14 MAR 2027", capacity = 30, closed, poses = 27, body, closeHref, homeHref = "/", onClose, onRetry }: ConvidadoLotadoProps = {}) {
  const x = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div className="row between" style={{ "alignSelf": "stretch" }}>
          {closeHref
            ? <Link href={closeHref} className="rv-icon-btn" aria-label="Fechar">{x}</Link>
            : <button type="button" className="rv-icon-btn" aria-label="Fechar" onClick={onClose}>{x}</button>}
          <span className="rv-stamp">
            {stamp}
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="grow" style={{ "display": "flex", "alignItems": "center", "justifyContent": "center", "margin": "0 -40px" }}>
          <div className="rv-stagebox" style={{ "filter": "grayscale(.7) brightness(.7)" }}>
            <div style={{ "width": "330px", "maxWidth": "100%", "transform": "scale(1.62)" }}>
              <CameraStage wrap={wrap} size={640} priority print={{ name: title, poses }} />
            </div>
          </div>
        </div>
        <h1 className="rv-title-lg">
          {closed ? "Esta câmera já fechou" : "A câmera lotou"}
        </h1>
        <p className="rv-body muted" style={{ "margin": "12px 0 22px", "maxWidth": "300px" }}>
          {body ?? (closed
            ? "Esta festa já terminou. As fotos continuam com quem estava lá."
            : `Os ${capacity ? `${capacity} ` : ""}lugares do ${title} já foram ocupados. Avisamos o anfitrião, que pode abrir mais vagas.`)}
        </p>
        {closed ? (
          <Link href={homeHref} className="rv-btn rv-btn--block">Voltar ao início</Link>
        ) : (
          <button type="button" className="rv-btn rv-btn--block" onClick={onRetry}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
            </svg>
            Tentar de novo
          </button>
        )}
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
