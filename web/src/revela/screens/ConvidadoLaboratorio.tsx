/* Gerado de design-system/revela/html/Convidado-laboratorio.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import Link from "next/link";
import { GuestTabs } from "../GuestTabs";

export interface LaboratorioProps {
  code?: string;
  /** "SÁB 14 MAR" */
  stamp?: string;
  title?: string;
  live?: boolean;
  photos?: number;
  guests?: number;
  /** contagem até a revelação; `null` esconde os visores */
  countdown?: { h: number; m: number; s: number } | null;
  /** "Revela domingo, 12:00" */
  revealLabel?: string;
  /** texto do botão principal, ex.: "Abrir câmera · 18 poses" */
  cta?: string;
}
const p2 = (n: number) => String(n).padStart(2, "0");

export function ConvidadoLaboratorio({ code, stamp = "SÁB 14 MAR", title = "Ana & Leo", live = true, photos = 418, guests = 32, countdown = { h: 27, m: 17, s: 40 }, revealLabel = "Revela domingo, 12:00", cta = "Abrir câmera · 18 poses" }: LaboratorioProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "paddingBottom": "92px" }}>
        <div className="row between">
          <div>
            <div className="rv-stamp" style={{ "fontSize": "12px" }}>{stamp}</div>
            <h1 className="rv-display" style={{ "fontSize": "34px", "lineHeight": "36px", "marginTop": "4px" }}>{title}</h1>
          </div>
          {live ? <span className="live"><i />Rolando</span> : <span className="rv-caption">Encerrada</span>}
        </div>
        <div className="lab">
          <div className="stackviz" style={{ "width": "300px", "height": "230px", "margin": "0 auto" }}>
            <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "40px", "top": "24px", "width": "150px", "height": "190px", "transform": "rotate(-9deg)", "zIndex": "1" }} />
            <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "110px", "top": "6px", "width": "150px", "height": "190px", "transform": "rotate(5deg)", "zIndex": "2" }} />
            <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "76px", "top": "40px", "width": "150px", "height": "190px", "transform": "rotate(-2deg)", "zIndex": "3" }} />
          </div>
          <p className="rv-stamp" style={{ "textAlign": "center" }}>
            NO LABORATÓRIO
          </p>
          <h2 className="rv-title" style={{ "textAlign": "center", "marginTop": "6px" }}>
            418 fotos de 32 convidados
          </h2>
          <p className="rv-caption" style={{ "textAlign": "center", "marginTop": "4px" }}>
            Ninguém vê antes. Nem quem tirou.
          </p>
        </div>
        {countdown && (
        <div className="countdown" style={{ "marginTop": "18px" }} role="timer" aria-label={`Revela em ${countdown.h} horas e ${countdown.m} minutos`}>
          <div><b>{p2(countdown.h)}</b><span>horas</span></div>
          <div><b>{p2(countdown.m)}</b><span>min</span></div>
          <div><b>{p2(countdown.s)}</b><span>seg</span></div>
        </div>
        )}
        <p className="rv-caption" style={{ "textAlign": "center", "marginTop": "8px" }}>{revealLabel}</p>
        <div className="grow" />
        <div className="row" style={{ "gap": "8px" }}>
          <Link href={code ? `/e/${code}/postar` : "#"} className="rv-btn rv-btn--block rv-btn--primary" style={{ "flex": "1" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {cta}
          </Link>
          <Link href={code ? `/e/${code}/programacao` : "#"} className="rv-icon-btn" style={{ "width": "56px", "height": "56px" }} aria-label="Programação">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </Link>
        </div>
      </div>
      <GuestTabs code={code} current="feed" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
