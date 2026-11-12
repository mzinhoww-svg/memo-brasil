"use client";
/* Gerado de design-system/revela/html/Convidado-editar.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export type FilmId = "none" | "filme400" | "pb" | "quente" | "vintage";
export const FILMS: { id: FilmId; label: string }[] = [
  { id: "none", label: "Sem filme" }, { id: "filme400", label: "Filme 400" }, { id: "pb", label: "Preto e branco" }, { id: "quente", label: "Quente" }, { id: "vintage", label: "Vintage" },
];
export interface EditarProps {
  src?: string;
  alt?: string;
  /** legenda impressa: esquerda ("'27 03 14 · 21:32") e direita ("por Bia") */
  capLeft?: string;
  capRight?: string;
  film?: FilmId;
  /** rotação já aplicada, em graus */
  rotate?: number;
  onFilm?: (f: FilmId) => void;
  onClose?: () => void;
  onSave?: () => void;
  onCrop?: () => void;
  onRotate?: () => void;
  onDate?: () => void;
  onDownload?: () => void;
}

export function ConvidadoEditar({ src = "/revela/ref/sc-brinde.jpg", alt = "Foto de convidado", capLeft = "'27 03 14 · 21:32", capRight = "por Bia", film = "filme400", rotate = 0, onFilm, onClose, onSave, onCrop, onRotate, onDate, onDownload }: EditarProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "background": "var(--k-070606)" }}>
        <div className="row between">
          <button type="button" className="rv-icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span className="rv-caption">
            Editar
          </span>
          <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" onClick={onSave}>
            Salvar
          </button>
        </div>
        <div className="grow" style={{ "display": "flex", "alignItems": "center", "justifyContent": "center" }}>
          <div className="rv-print" style={{ "width": "320px", "height": "410px", "transform": "rotate(0deg)", "zIndex": "1" }}>
            <img src={src} alt={alt} style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }} />
            <div className="rv-print__cap">
              <span>{capLeft}</span>
              <span>{capRight}</span>
            </div>
          </div>
        </div>
        <div className="row" style={{ "gap": "8px", "overflow": "hidden", "margin": "0 -20px 14px", "padding": "0 20px" }}>
          {FILMS.map((f) => (
            <button key={f.id} type="button" className={`chip${film === f.id ? " on" : ""}`} aria-pressed={film === f.id} onClick={() => onFilm?.(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="row" style={{ "justifyContent": "space-around" }}>
          <button type="button" className="rv-icon-btn" aria-label="Cortar" onClick={onCrop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />
            </svg>
          </button>
          <button type="button" className="rv-icon-btn" aria-label="Girar" onClick={onRotate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9M3 4v5h5" />
            </svg>
          </button>
          <button type="button" className="rv-icon-btn" aria-label="Data" onClick={onDate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </button>
          <button type="button" className="rv-icon-btn" aria-label="Baixar" onClick={onDownload}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
          </button>
        </div>
        <p className="rv-caption center" style={{ "marginTop": "10px" }}>
          A versão editada vai para o seu celular. A original fica no feed.
        </p>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
