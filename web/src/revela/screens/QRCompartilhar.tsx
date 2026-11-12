"use client";
/* QR-compartilhar.html (26): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { svgProps, useEmbedded } from "../painel-ui";

export interface QRCompartilharProps {
  cam?: string;
  link?: string;
  /** "Copiar" vira "Copiado" por um instante. */
  copied?: boolean;
  onClose?: () => void;
  onCopy?: () => void;
  onWhatsapp?: () => void;
  onStories?: () => void;
  onQr?: () => void;
  onDownload?: () => void;
}

export function QRCompartilhar({ cam = "/revela/ref/cam-casamento.webp", link = "revela.app/e/ana-leo", copied = false, onClose, onCopy, onWhatsapp, onStories, onQr, onDownload }: QRCompartilharProps = {}) {
  const embedded = useEmbedded();
  const Title = embedded ? "h2" : "h1";
  return (
    <>
    <div className="scr sheet-scr">
      <div className="safe" style={embedded ? undefined : { "opacity": ".4" }}>
        <div className="rv-stagebox">
          <img src={cam} alt="" style={{ "width": embedded ? "min(240px, 70%)" : "340px" }} />
        </div>
      </div>
      <div className="sheet-full" style={{ "top": "auto", "height": "520px" }}>
        <div className="rv-sheet__grab" />
        <Title className="rv-title" style={{ "marginBottom": "4px" }}>
          Chame os convidados
        </Title>
        <p className="rv-caption" style={{ "marginBottom": "16px" }}>
          Quem escaneia o QR entra direto na câmera do evento.
        </p>
        <div className="linkbox">
          <span>
            {link}
          </span>
          <button type="button" className="rv-btn rv-btn--sm rv-btn--primary" onClick={onCopy}>
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <div className="sharegrid">
          <button type="button" onClick={onWhatsapp}>
            <svg {...svgProps}>
              <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />
            </svg>
            <span>
              WhatsApp
            </span>
          </button>
          <button type="button" onClick={onStories}>
            <svg {...svgProps}>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
            </svg>
            <span>
              Stories
            </span>
          </button>
          <button type="button" onClick={onQr}>
            <svg {...svgProps}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4" />
            </svg>
            <span>
              QR na tela
            </span>
          </button>
          <button type="button" onClick={onDownload}>
            <svg {...svgProps}>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            <span>
              Baixar QR code
            </span>
          </button>
        </div>
        <div className="grow" />
        <button type="button" className="rv-btn rv-btn--block" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
