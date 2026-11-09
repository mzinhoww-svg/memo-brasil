"use client";
/* Anfitriao-moderar.html (17c): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, ScreenFoot, svgProps } from "../painel-ui";

export interface ModItem { id: string; src: string; name: string; off?: boolean; alt?: string }
export interface AnfitriaoModerarProps {
  stamp?: string;
  intro?: string;
  items?: ModItem[];
  /** Mostra "Revelar agora" (só enquanto a revelação está pendente). */
  canReveal?: boolean;
  /** Rótulo de quando não há fotos. */
  empty?: string;
  onBack?: () => void;
  onItem?: (id: string) => void;
  onReveal?: () => void;
  /** Há mais fotos além das mostradas. */
  onMore?: () => void;
}

export const MODERAR_REF: Required<AnfitriaoModerarProps> = {
  stamp: "REVELA EM 13:42",
  intro: "Tire o que não deve aparecer. O resto revela para todos no domingo, às 12:00.",
  items: [
    { id: "1", src: "/revela/ref/sc-pista.jpg", name: "Bia" },
    { id: "2", src: "/revela/ref/sc-bolo.jpg", name: "Rafa" },
    { id: "3", src: "/revela/ref/sc-camera.jpg", name: "Leo · removida", off: true },
    { id: "4", src: "/revela/ref/sc-aliancas.jpg", name: "Leo" },
    { id: "5", src: "/revela/ref/sc-baloes.jpg", name: "Tia Lu" },
    { id: "6", src: "/revela/ref/sc-bolo-natural.jpg", name: "Ana" },
  ],
  canReveal: true, empty: "", onBack: () => undefined, onItem: () => undefined, onReveal: () => undefined, onMore: () => undefined,
};

export function AnfitriaoModerar({ stamp = MODERAR_REF.stamp, intro = MODERAR_REF.intro, items = MODERAR_REF.items, canReveal = MODERAR_REF.canReveal, empty = MODERAR_REF.empty, onBack, onItem, onReveal, onMore }: AnfitriaoModerarProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onBack} />
          <span className="rv-stamp" style={{ "fontSize": "12px" }}>
            {stamp}
          </span>
        </div>
        <h1 className="rv-title-lg" style={{ "marginTop": "16px" }}>
          Só você vê isto
        </h1>
        <p className="rv-body muted" style={{ "margin": "8px 0 16px" }}>
          {intro}
        </p>
        {items.length === 0 && empty ? <p className="rv-caption">{empty}</p> : null}
        <div className="modgrid">
          {items.map((it) => (
            <div key={it.id} className={it.off ? "mod off" : "mod"} role={onItem ? "button" : undefined} tabIndex={onItem ? 0 : undefined} aria-label={onItem ? `Foto de ${it.name}` : undefined}
              onClick={onItem ? () => onItem(it.id) : undefined} onKeyDown={onItem ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onItem(it.id); } } : undefined} style={onItem ? { cursor: "pointer" } : undefined}>
              <img src={it.src} alt={it.alt ?? ""} loading="lazy" />
              {it.off && (
                <i>
                  <svg {...svgProps}>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </i>
              )}
              <span className="rv-caption">
                {it.name}
              </span>
            </div>
          ))}
        </div>
        {onMore && <button type="button" className="rv-btn rv-btn--text" style={{ "alignSelf": "center", "marginTop": "8px" }} onClick={onMore}>Ver mais fotos</button>}
        <div className="grow" />
        {canReveal && (
          <button type="button" className="rv-btn rv-btn--block rv-btn--line" onClick={onReveal}>
            <svg {...svgProps}>
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
            </svg>
            Revelar agora
          </button>
        )}
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
