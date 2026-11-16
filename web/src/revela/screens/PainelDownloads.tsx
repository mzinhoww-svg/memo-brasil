"use client";
/* Painel-downloads.html (17h): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";
import { ScreenHeader, ScreenFoot, svgProps } from "../painel-ui";

export interface PainelDownloadsProps {
  zip?: { desc: string; /** 0–100 enquanto prepara; ausente = pronto para baixar */ pct?: number; progressText?: string; disabled?: boolean };
  csv?: { desc: string; disabled?: boolean };
  retro?: { desc: string; /** destino quando a retrospectiva já abre; ausente = indisponível */ href?: string };
  /** Resultado ou erro da última ação. */
  message?: { text: string; error?: boolean };
  note?: string;
  onBack?: () => void;
  onZip?: () => void;
  onCsv?: () => void;
}

export const DOWNLOADS_REF = {
  zip: { desc: "418 fotos · 1,2 GB · originais com filme", pct: 64, progressText: "Preparando… 64%" },
  csv: { desc: "32 pessoas · nome, mesa, fotos tiradas" },
  retro: { desc: "Disponível depois da revelação" },
  note: "As fotos ficam guardadas por 12 meses depois da revelação.",
};

export function PainelDownloads({ zip = DOWNLOADS_REF.zip, csv = DOWNLOADS_REF.csv, retro = DOWNLOADS_REF.retro, message, note = DOWNLOADS_REF.note, onBack, onZip, onCsv }: PainelDownloadsProps = {}) {
  const preparing = zip.pct !== undefined;
  return (
    <>
    <div className="scr">
      <div className="safe">
        <ScreenHeader onBack={onBack} title="Downloads" />
        <div className="dl">
          <div className="dl-ico">
            <svg {...svgProps}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
          </div>
          <div style={{ "flex": "1" }}>
            <b>
              Todas as fotos (ZIP)
            </b>
            <span className="rv-caption">
              {zip.desc}
            </span>
            {preparing && (
              <>
                <div className="prog">
                  <s style={{ "width": `${zip.pct}%` }} />
                </div>
                <span className="rv-caption">
                  {zip.progressText}
                </span>
              </>
            )}
          </div>
          {!preparing && onZip && (
            <button type="button" className="rv-btn rv-btn--sm" onClick={onZip} disabled={zip.disabled} aria-disabled={zip.disabled || undefined} style={zip.disabled ? { "opacity": ".4" } : undefined}>
              Baixar
            </button>
          )}
        </div>
        <div className="dl">
          <div className="dl-ico">
            <svg {...svgProps}>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
              <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.4.6 4 2.4 4 5.4" />
            </svg>
          </div>
          <div style={{ "flex": "1" }}>
            <b>
              Lista de convidados (CSV)
            </b>
            <span className="rv-caption">
              {csv.desc}
            </span>
          </div>
          <button type="button" className="rv-btn rv-btn--sm" onClick={onCsv} disabled={csv.disabled}>
            Baixar
          </button>
        </div>
        <div className="dl">
          <div className="dl-ico">
            <svg {...svgProps}>
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </div>
          <div style={{ "flex": "1" }}>
            <b>
              Retrospectiva
            </b>
            <span className="rv-caption">
              {retro.desc}
            </span>
          </div>
          {retro.href ? (
            <Link href={retro.href} className="rv-btn rv-btn--sm">
              Abrir
            </Link>
          ) : (
            <button type="button" className="rv-btn rv-btn--sm" aria-disabled="true" style={{ "opacity": ".4" }}>
              Baixar
            </button>
          )}
        </div>
        <div className="grow" />
        {message && <p className="rv-caption center" role={message.error ? "alert" : "status"} style={message.error ? { "color": "var(--danger)" } : undefined}>{message.text}</p>}
        <p className="rv-caption center">
          {note}
        </p>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
