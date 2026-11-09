/* Gerado de design-system/revela/html/Convidado-postar.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface RoloItem { src: string; on: boolean }
export interface RoloProps {
  /** limite de fotos por pessoa (texto do subtítulo); `null` = livre */
  perPerson?: number | null;
  /** quantas ainda cabem no rolo (teto da seleção) */
  cap?: number;
  items?: RoloItem[];
  busy?: boolean;
  onToggle?: (i: number) => void;
  onSend?: () => void;
  onClose?: () => void;
}
const DEFAULT_ITEMS: RoloItem[] = ["sc-brinde", "sc-bolo-natural", "sc-baloes", "sc-pista", "sc-camera", "sc-aliancas", "sc-bolo", "sc-pista", "sc-brinde"].map((n, i) => ({ src: `/revela/ref/${n}.jpg`, on: i === 0 || i === 2 || i === 8 }));

export function ConvidadoPostar({ perPerson = 10, cap = 10, items = DEFAULT_ITEMS, busy = false, onToggle, onSend, onClose }: RoloProps = {}) {
  const n = items.filter((x) => x.on).length;
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full" style={{ "top": "50px" }}>
        <button type="button" className="rv-sheet__grab" aria-label="Fechar" onClick={onClose} style={{ border: 0, padding: 0, cursor: "pointer" }} />
        <div className="row between">
          <div>
            <h1 className="rv-title">
              Do rolo da câmera
            </h1>
            <p className="rv-caption" style={{ "marginTop": "4px" }}>
              {perPerson === null ? "O anfitrião liberou fotos sem limite por pessoa." : `O anfitrião liberou até ${perPerson} fotos por pessoa.`}
            </p>
          </div>
          <span className="rv-stamp" style={{ "fontSize": "13px" }}>{`${n}/${cap}`}</span>
        </div>
        <div className="pickgrid">
          {items.map((it, i) => (
            <div key={i} className={`pick${it.on ? " on" : ""}`} role="checkbox" aria-checked={it.on} aria-label={`Foto ${i + 1}`} tabIndex={0} onClick={() => onToggle?.(i)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle?.(i); } }}>
              <img src={it.src} alt="" />
              {it.on && (
                <i>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                </i>
              )}
            </div>
          ))}
        </div>
        <p className="rv-caption" style={{ "marginTop": "12px" }}>
          Elas recebem o mesmo filme e ficam guardadas até a revelação.
        </p>
        <div className="grow" />
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" aria-disabled={n === 0 || busy} onClick={() => { if (n > 0 && !busy) onSend?.(); }}>
          {busy ? "Enviando…" : `Enviar ${n} ${n === 1 ? "foto" : "fotos"}`}
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
