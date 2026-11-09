"use client";
/* Painel-aviso.html (17g): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, Chevron, RowAction, ScreenFoot, svgProps } from "../painel-ui";

export interface PainelAvisoProps {
  text?: string;
  max?: number;
  mode?: "agora" | "agendar";
  /** "sáb, 14 mar, 22:15": só aparece em "Agendar". */
  when?: string;
  previewName?: string;
  previewTime?: string;
  cta?: string;
  busy?: boolean;
  disabled?: boolean;
  error?: string;
  /** Aviso que já está no ar (um por vez): linha de apoio com a ação de apagar. */
  current?: string;
  onText?: (value: string) => void;
  onMode?: (mode: "agora" | "agendar") => void;
  onWhen?: () => void;
  onSend?: () => void;
  onClear?: () => void;
  onBack?: () => void;
}

export const AVISO_REF = {
  text: "O bolo vai ser cortado às 22:30. Guardem umas poses para esse momento!", max: 140, when: "sáb, 14 mar, 22:15", previewName: "Ana & Leo", previewTime: "22:15", cta: "Agendar aviso",
};

export function PainelAviso({ text = AVISO_REF.text, max = AVISO_REF.max, mode = "agendar", when = AVISO_REF.when, previewName = AVISO_REF.previewName, previewTime = AVISO_REF.previewTime, cta = AVISO_REF.cta, busy = false, disabled = false, error, current, onText, onMode, onWhen, onSend, onClear, onBack }: PainelAvisoProps = {}) {
  const seg = (m: "agora" | "agendar", label: string) => (
    <span className={mode === m ? "on" : ""} role={onMode ? "button" : undefined} tabIndex={onMode ? 0 : undefined} aria-pressed={onMode ? mode === m : undefined}
      onClick={onMode ? () => onMode(m) : undefined} onKeyDown={onMode ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMode(m); } } : undefined} style={onMode ? { cursor: "pointer" } : undefined}>
      {label}
    </span>
  );
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onBack} />
          <h1 className="rv-title" style={{ "fontSize": "18px" }}>
            Novo aviso
          </h1>
          <span style={{ "width": "44px" }} />
        </div>
        {current && (
          <p className="rv-caption" style={{ "marginTop": "14px" }}>
            {current}{" "}
            <button type="button" className="rv-btn rv-btn--text" onClick={onClear}>Apagar aviso</button>
          </p>
        )}
        <label className="rv-field rv-field--focus area" style={{ "marginTop": "16px" }}>
          <textarea aria-label="Mensagem" value={onText ? text : undefined} defaultValue={onText ? undefined : text} maxLength={max} onChange={onText ? (e) => onText(e.target.value) : undefined} />
        </label>
        <p className="rv-caption" style={{ "textAlign": "right", "marginTop": "6px" }}>
          {text.length}/{max}
        </p>
        <h2 className="rv-group-h">
          Quando enviar
        </h2>
        <div className="seg">
          {seg("agora", "Agora")}
          {seg("agendar", "Agendar")}
        </div>
        {mode === "agendar" && (
          <div className="rv-group" style={{ "marginTop": "10px" }}>
            <RowAction onClick={onWhen}>
              <svg {...svgProps}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <div className="rv-row__text">
                <span className="rv-row__meta">
                  Envia
                </span>
                {when}
              </div>
              <Chevron />
            </RowAction>
          </div>
        )}
        <h2 className="rv-group-h">
          Prévia
        </h2>
        <div className="lk-note" style={{ "background": "var(--surface-2)" }}>
          <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="16" fill="var(--surface-1)" />
            <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
            <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="lk-h">
              <b>
                {previewName}
              </b>
              <span>
                {previewTime}
              </span>
            </div>
            <div className="lk-b">
              {text}
            </div>
          </div>
        </div>
        <div className="grow" />
        {error && <p className="rv-caption" role="alert" style={{ "color": "var(--danger)", "marginBottom": "8px" }}>{error}</p>}
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onSend} disabled={busy || disabled}>
          <svg {...svgProps}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
          {busy ? "Enviando…" : cta}
        </button>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
