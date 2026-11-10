"use client";
/* Revelados-galeria.html (18): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";
import { HostTabs } from "../HostTabs";

export interface GaleriaPrint { src: string; stampLeft: string; stampRight: string; href?: string }
export const GALERIA_REF_PRINTS: GaleriaPrint[] = [
  { src: "/revela/ref/sc-pista.jpg", stampLeft: "'27 03 14", stampRight: "Bia" },
  { src: "/revela/ref/sc-aliancas.jpg", stampLeft: "'27 03 14", stampRight: "Leo" },
  { src: "/revela/ref/sc-bolo.jpg", stampLeft: "'27 03 14", stampRight: "Rafa" },
  { src: "/revela/ref/sc-baloes.jpg", stampLeft: "'27 03 14", stampRight: "Ana" },
  { src: "/revela/ref/sc-camera.jpg", stampLeft: "'27 03 14", stampRight: "Lu" },
];
const SLOTS = [
  { left: "0px", top: "0px", width: "146px", height: "184px", transform: "rotate(-6deg)", zIndex: "1" },
  { left: "176px", top: "10px", width: "146px", height: "184px", transform: "rotate(5deg)", zIndex: "2" },
  { left: "14px", top: "190px", width: "146px", height: "184px", transform: "rotate(3deg)", zIndex: "3" },
  { left: "186px", top: "206px", width: "146px", height: "184px", transform: "rotate(-4deg)", zIndex: "4" },
  { left: "112px", top: "318px", width: "120px", height: "150px", transform: "rotate(9deg)", zIndex: "5" },
] as const;

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export interface ReveladosGaleriaProps {
  /** "Ana & Leo · 418 fotos de 32 convidados · hoje, 12:00" */
  caption?: string;
  prints?: GaleriaPrint[];
  backHref?: string;
  downloadHref?: string;
  albumHref?: string;
  onFilter?: () => void;
  /** texto quando não há foto para mostrar */
  empty?: string;
}

export function ReveladosGaleria({ caption = "Ana & Leo · 418 fotos de 32 convidados · hoje, 12:00", prints = GALERIA_REF_PRINTS, backHref, downloadHref, albumHref, onFilter, empty }: ReveladosGaleriaProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ paddingBottom: "92px", ...(backHref ? { overflowY: "auto" } : {}) }}>
        <div className="row between">
          <Link href={backHref ?? "#"} className="rv-icon-btn" aria-label="Voltar">
            <svg {...svg}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <Link href={downloadHref ?? "#"} className="rv-icon-btn" aria-label="Baixar tudo">
            <svg {...svg}>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
          </Link>
        </div>
        <h1 className="rv-display" style={{ fontSize: "44px", lineHeight: "46px", marginTop: "14px" }}>Revelado.</h1>
        <p className="rv-caption" style={{ marginTop: "6px" }}>{caption}</p>
        <div className="table">
          {prints.slice(0, 5).map((p, i) => {
            const body = (
              <>
                <img src={p.src} alt="Foto de convidado" />
                <div className="rv-print__cap">
                  <span>{p.stampLeft}</span>
                  <span>{p.stampRight}</span>
                </div>
              </>
            );
            const style = { position: "absolute" as const, ...SLOTS[i] };
            return p.href
              ? <Link key={i} href={p.href} className="rv-print" style={style} aria-label={`Abrir a foto de ${p.stampRight}`}>{body}</Link>
              : <div key={i} className="rv-print" style={style}>{body}</div>;
          })}
          {empty && <p className="rv-caption" style={{ textAlign: "center", marginTop: "24px" }}>{empty}</p>}
        </div>
        <div className="row" style={{ gap: "8px", position: "relative", zIndex: "6" }}>
          <Link href={albumHref ?? "#"} className="rv-btn rv-btn--block rv-btn--paper" style={{ flex: "1" }}>Ver como álbum</Link>
          <button type="button" className="rv-icon-btn" style={{ width: "56px", height: "56px" }} aria-label="Filtrar" onClick={onFilter}>
            <svg {...svg}>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
              <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.4.6 4 2.4 4 5.4" />
            </svg>
          </button>
        </div>
      </div>
      <HostTabs current="revelados" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
