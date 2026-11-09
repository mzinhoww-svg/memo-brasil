"use client";
/* Painel-convites.html (17e): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, RowAction, ScreenFoot, svgProps } from "../painel-ui";

export interface InviteRow { id: string; label: string; meta: string; off?: boolean }
export interface PainelConvitesProps {
  rows?: InviteRow[];
  onBack?: () => void;
  onNew?: () => void;
  onRow?: (id: string) => void;
  onPrint?: () => void;
}

export const CONVITES_REF: InviteRow[] = [
  { id: "geral", label: "Geral (link e convite A5)", meta: "14 entraram" },
  { id: "m1", label: "Mesa 1 · Família da noiva", meta: "6 entraram · limite 10" },
  { id: "m2", label: "Mesa 2 · Família do noivo", meta: "5 entraram · limite 10" },
  { id: "m4", label: "Mesa 4 · Amigos da faculdade", meta: "7 entraram · limite 10" },
  { id: "m7", label: "Mesa 7 · Trabalho", meta: "0 entraram · limite 8" },
  { id: "old", label: "Link antigo do WhatsApp", meta: "Revogado", off: true },
];

export function PainelConvites({ rows = CONVITES_REF, onBack, onNew, onRow, onPrint }: PainelConvitesProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onBack} />
          <h1 className="rv-title" style={{ "fontSize": "18px" }}>
            Convites e mesas
          </h1>
          <button type="button" className="rv-icon-btn" aria-label="Novo convite" onClick={onNew}>
            <svg {...svgProps}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <p className="rv-caption" style={{ "marginTop": "14px" }}>
          Cada mesa pode ter o seu QR. Assim cada foto sai com a mesa de quem tirou.
        </p>
        <div className="rv-group" style={{ "marginTop": "14px" }}>
          {rows.map((r) => (
            <RowAction key={r.id} className={r.off ? "rv-row inv-off" : "rv-row"} onClick={onRow ? () => onRow(r.id) : undefined}>
              <svg {...svgProps}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4" />
              </svg>
              <div className="rv-row__text">
                {r.label}
                <span className="rv-row__meta">
                  {r.meta}
                </span>
              </div>
              <span className="rv-row__end">
                <svg {...svgProps}>
                  <circle cx="5" cy="12" r="1.2" />
                  <circle cx="12" cy="12" r="1.2" />
                  <circle cx="19" cy="12" r="1.2" />
                </svg>
              </span>
            </RowAction>
          ))}
        </div>
        <div className="grow" />
        <div className="row" style={{ "gap": "8px" }}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ "flex": "1" }} onClick={onPrint}>
            <svg {...svgProps}>
              <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
            </svg>
            Imprimir cartões de mesa
          </button>
        </div>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
