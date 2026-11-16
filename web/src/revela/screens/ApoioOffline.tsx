"use client";
/* Gerado de design-system/revela/html/Apoio-offline.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface ApoioOfflineProps {
  image?: string; title?: string; message?: string; left?: string; leftLabel?: string;
  onClose?: () => void; onRetry?: () => void;
}

export function ApoioOffline({
  image = "/revela/ref/sc-pista.jpg", title = "Ana & Leo", message = "Sem internet. 3 fotos esperando para subir.", left = "15", leftLabel = "poses restantes", onClose, onRetry,
}: ApoioOfflineProps = {}) {
  return (
    <>
    <div className="scr camscr">
      <div className="vf">
        <img src={image} alt="Visor da câmera" style={{  }} />
        <div className="vf-top">
          <button className="glass" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="vf-title">
            {title}
          </div>
          <button className="glass" aria-label="Flash">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
            </svg>
          </button>
        </div>
        <div className="vf-corners">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="offbar" {...(onRetry ? { role: "button" as const, tabIndex: 0, "aria-label": "Tentar de novo", style: { cursor: "pointer" }, onClick: onRetry, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRetry(); } } } : {})}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5-2.5M19 12.6a10 10 0 0 0-2.6-1.8M2 8.8a15 15 0 0 1 4.3-2.7M22 8.8A15 15 0 0 0 11 4.6M12 20h.01" />
        </svg>
        <span>
          {message}
        </span>
      </div>
      <div className="body body--casamento">
        <div className="body-shade" />
        <div className="body-row">
          <div className="rv-counter">
            <b>
              {left}
            </b>
            <span>
              {leftLabel}
            </span>
          </div>
          <button className="shutter" aria-label="Tirar foto" onClick={onRetry}>
            <i />
          </button>
          <div className="wheel" aria-hidden="true" />
        </div>
        <div className="body-foot">
          <button className="filmstack" aria-label="Minhas fotos">
            <i />
            <i />
          </button>
          <span />
          <button className="rv-icon-btn" style={{ "background": "var(--k-00000022)", "color": "var(--wrap-casamento-ink)" }} aria-label="Virar câmera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <path d="M9 13a3 3 0 0 1 5-2l1 1M15 13a3 3 0 0 1-5 2l-1-1" />
            </svg>
          </button>
        </div>
      </div>
      <div className="grain" />
    </div>
    </>
  );
}
