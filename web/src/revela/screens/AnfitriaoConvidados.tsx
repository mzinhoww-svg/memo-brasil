"use client";
/* Anfitriao-convidados.html (17b): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, RowAction, ScreenFoot, svgProps } from "../painel-ui";

export interface GuestRow { id: string; initial: string; name: string; meta: string; used: number; shots: number | null; blocked?: boolean }
export interface AnfitriaoConvidadosProps {
  summary?: string;
  pct?: number;
  guests?: GuestRow[];
  /** Quantos lugares ainda não foram usados; 0 ou ausente omite o grupo. */
  missing?: number;
  missingMeta?: string;
  onBack?: () => void;
  onInvite?: () => void;
  onRemind?: () => void;
  onGuest?: (id: string) => void;
}

export const CONVIDADOS_REF: Required<AnfitriaoConvidadosProps> = {
  summary: "32 de 50 entraram · 418 poses no filme", pct: 64,
  guests: [
    { id: "a", initial: "B", name: "Bia Moraes", meta: "última pose há 2 min", used: 24, shots: 27 },
    { id: "b", initial: "L", name: "Leo Antunes", meta: "noivo", used: 19, shots: 27 },
    { id: "c", initial: "T", name: "Tia Lu", meta: "filme acabou", used: 27, shots: 27 },
    { id: "d", initial: "R", name: "Rafa Costa", meta: "entrou às 21:40", used: 11, shots: 27 },
  ],
  missing: 18, missingMeta: "Mande o link de novo pelo WhatsApp",
  onBack: () => undefined, onInvite: () => undefined, onRemind: () => undefined, onGuest: () => undefined,
};

export function AnfitriaoConvidados({ summary = CONVIDADOS_REF.summary, pct = CONVIDADOS_REF.pct, guests = CONVIDADOS_REF.guests, missing = CONVIDADOS_REF.missing, missingMeta = CONVIDADOS_REF.missingMeta, onBack, onInvite, onRemind, onGuest }: AnfitriaoConvidadosProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onBack} />
          <button type="button" className="rv-icon-btn" aria-label="Convidar" onClick={onInvite}>
            <svg {...svgProps}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <h1 className="rv-title-lg" style={{ "marginTop": "16px" }}>
          Convidados
        </h1>
        <p className="rv-caption" style={{ "marginTop": "6px" }}>
          {summary}
        </p>
        <div className="meter">
          <i style={{ "width": `${pct}%` }} />
        </div>
        <div className="rv-group-h">
          Fotografando agora
        </div>
        <div className="rv-group rv-rise">
          {guests.map((g) => (
            <RowAction key={g.id} onClick={onGuest ? () => onGuest(g.id) : undefined}>
              <span className="avatar avatar--sm">
                {g.initial}
              </span>
              <div className="rv-row__text">
                {g.name}
                <span className="rv-row__meta">
                  {g.meta}
                </span>
              </div>
              <span className="gpose">
                <b>
                  {g.used}
                </b>
                {g.shots === null ? "" : `/${g.shots}`}
              </span>
            </RowAction>
          ))}
        </div>
        {missing > 0 && (
          <>
            <div className="rv-group-h">
              Ainda não entraram
            </div>
            <div className="rv-group rv-rise">
              <RowAction onClick={onRemind}>
                <svg {...svgProps}>
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
                  <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.4.6 4 2.4 4 5.4" />
                </svg>
                <div className="rv-row__text">
                  {missing} {missing === 1 ? "convidado" : "convidados"}
                  <span className="rv-row__meta">
                    {missingMeta}
                  </span>
                </div>
                <span className="rv-row__end">
                  <svg {...svgProps}>
                    <path d="M12 3v13M7 8l5-5 5 5" />
                    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                  </svg>
                </span>
              </RowAction>
            </div>
          </>
        )}
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
