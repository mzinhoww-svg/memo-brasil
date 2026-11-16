"use client";
/* Feed-denunciar.html (24g): mesmo markup da referência; serve à foto e ao comentário (dados reais por props, padrão = desenho). */
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const DENUNCIA_MOTIVOS_FOTO = ["Não quero aparecer nesta foto", "Foto constrangedora", "Conteúdo impróprio", "Outro motivo"];
export const DENUNCIA_MOTIVOS_COMENTARIO = ["Ofensivo ou desrespeitoso", "Spam ou propaganda", "Conteúdo impróprio", "Outro motivo"];

export interface FeedDenunciarProps {
  title?: string;
  /** "Denunciar esta foto" */
  heading?: string;
  caption?: string;
  reasons?: string[];
  selected?: number;
  onSelect?: (i: number) => void;
  onBack?: () => void;
  onSubmit?: () => void;
  /** texto do botão principal */
  cta?: string;
  disabled?: boolean;
  /** mensagem de estado (enviado / erro) */
  message?: string;
}

export function FeedDenunciar({ title = "Ana & Leo", heading = "Denunciar esta foto", caption = "Só os anfitriões veem a denúncia. Quem tirou não sabe quem foi.", reasons = DENUNCIA_MOTIVOS_FOTO, selected = 1, onSelect, onBack, onSubmit, cta = "Enviar denúncia", disabled, message }: FeedDenunciarProps = {}) {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="safe" style={{ opacity: ".35" }}>
        <div className="row between">
          <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
            <svg {...svg}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ fontSize: "18px" }}>{title}</span>
          <span style={{ width: "44px" }} />
        </div>
      </div>
      <div className="sheet-full" style={{ top: "auto", height: "560px" }} role={onBack ? "dialog" : undefined} aria-label={onBack ? heading : undefined}>
        <div className="rv-sheet__grab" />
        <h1 className="rv-title">{heading}</h1>
        <p className="rv-caption" style={{ marginTop: "4px" }}>{caption}</p>
        <div className="rv-group" style={{ marginTop: "16px" }} role={onSelect ? "radiogroup" : undefined} aria-label={onSelect ? "Motivo" : undefined}>
          {reasons.map((r, i) => (
            <div key={r} className="rv-row" {...(onSelect ? { role: "radio", "aria-checked": i === selected, tabIndex: 0, style: { cursor: "pointer" }, onClick: () => onSelect(i), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); } } } : {})}>
              <div className="rv-row__text">{r}</div>
              <i className={i === selected ? "radio on" : "radio"} />
            </div>
          ))}
        </div>
        <div className="grow" />
        {message && <p className="rv-caption" role="status" style={{ margin: "0 0 10px", textAlign: "center" }}>{message}</p>}
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onSubmit} disabled={disabled}>{cta}</button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
