"use client";
/* Painel-programacao.html (17f): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { ScreenHeader, RowAction, ScreenFoot, svgProps } from "../painel-ui";

export interface PainelProgramacaoProps {
  place?: string;
  moments?: { time: string; name: string }[];
  /** Salvar fica ativo só com alterações; `saving` troca o rótulo. */
  canSave?: boolean;
  saving?: boolean;
  error?: string;
  onBack?: () => void;
  onPlace?: (value: string) => void;
  onEdit?: (index: number) => void;
  onAdd?: () => void;
  onSave?: () => void;
}

export const PROGRAMACAO_REF = {
  place: "Espaço Vila Jardim, Cuiabá",
  moments: [
    { time: "16:30", name: "Cerimônia" }, { time: "17:30", name: "Fotos com os noivos" }, { time: "19:00", name: "Jantar" },
    { time: "21:00", name: "Primeira dança" }, { time: "22:30", name: "Bolo" }, { time: "23:00", name: "Pista até o fim" },
  ],
};

export function PainelProgramacao({ place = PROGRAMACAO_REF.place, moments = PROGRAMACAO_REF.moments, canSave = true, saving = false, error, onBack, onPlace, onEdit, onAdd, onSave }: PainelProgramacaoProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <ScreenHeader onBack={onBack} title="Programação" action={(
          <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" onClick={onSave} disabled={!canSave || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        )} />
        <label className="rv-field" style={{ "marginTop": "16px" }}>
          <svg {...svgProps}>
            <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <input defaultValue={onPlace ? undefined : place} value={onPlace ? place : undefined} onChange={onPlace ? (e) => onPlace(e.target.value) : undefined} maxLength={80} placeholder="Local do evento" aria-label="Local" />
        </label>
        {error && <p className="rv-caption" role="alert" style={{ "color": "var(--danger)", "marginTop": "8px" }}>{error}</p>}
        <h2 className="rv-group-h">
          Momentos
        </h2>
        <div className="rv-group">
          {moments.map((m, i) => (
            <RowAction key={`${m.time}-${m.name}-${i}`} onClick={onEdit ? () => onEdit(i) : undefined}>
              <span className="rv-stamp" style={{ "fontSize": "14px", "width": "48px" }}>
                {m.time || "--:--"}
              </span>
              <div className="rv-row__text">
                {m.name}
              </div>
              <span className="rv-row__end">
                <svg {...svgProps}>
                  <path d="M4 20h4L19 9l-4-4L4 16z" />
                </svg>
              </span>
            </RowAction>
          ))}
        </div>
        <button type="button" className="rv-btn rv-btn--text" style={{ "alignSelf": "flex-start", "marginTop": "8px" }} onClick={onAdd}>
          <svg {...svgProps}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {" Adicionar momento"}
        </button>
        <div className="grow" />
        <p className="rv-caption center">
          {"Os convidados veem isso em \"Programação\"."}
        </p>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
