"use client";
/* QR-convite.html (25): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, QrSvg, ScreenFoot, svgProps } from "../painel-ui";

export interface QRConviteProps {
  name?: string;
  date?: string;
  copy?: string;
  stamp?: string;
  /** Modelo mostrado (1 a `models`). */
  model?: number;
  models?: number;
  /** Matriz do QR real; ausente = o QR do desenho. */
  qr?: boolean[][];
  /** Proporção do cartão: o desenho é o retrato do cartão A6. */
  square?: boolean;
  onClose?: () => void;
  onRatio?: () => void;
  onModel?: (model: number) => void;
  onDownload?: () => void;
}

export const QR_CONVITE_REF = {
  name: "Ana & Leo", date: "14 de março de 2027", stamp: "REVELA DOM 12:00",
  copy: "Aponte a câmera do celular para o código, pegue a câmera do casamento e fotografe a festa pelo seu olhar. Você tem 27 poses.",
};

export function QRConvite({ name = QR_CONVITE_REF.name, date = QR_CONVITE_REF.date, copy = QR_CONVITE_REF.copy, stamp = QR_CONVITE_REF.stamp, model = 2, models = 4, qr, square = false, onClose, onRatio, onModel, onDownload }: QRConviteProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onClose} label="Fechar" close />
          <span className="rv-caption">
            {`Modelo ${model} de ${models}`}
          </span>
          <button type="button" className="rv-icon-btn" aria-label="Proporção" onClick={onRatio}>
            <svg {...svgProps}>
              <rect x="3" y="6" width="18" height="12" rx="2" />
            </svg>
          </button>
        </div>
        <div className="grow" style={{ "display": "flex", "alignItems": "center", "justifyContent": "center" }}>
          <div className="tablecard" style={square ? { "aspectRatio": "1 / 1" } : undefined}>
            <div className="tc-top">
              <div>
                <div style={{ "font": "400 34px/36px var(--font-display)" }}>
                  {name}
                </div>
                <div style={{ "font": "400 13px/18px var(--font-sans)", "color": "var(--k-5c5048)", "marginTop": "4px" }}>
                  {date}
                </div>
              </div>
              <QrSvg size={96} modules={qr} />
            </div>
            <div className="tc-rule" />
            <p className="tc-copy">
              {copy}
            </p>
            <div className="tc-foot">
              <svg width="20" height="20" viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="16" fill="var(--on-paper)" />
                <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
                <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
              </svg>
              <span style={{ "font": "400 14px/1 var(--font-display)" }}>
                revela
              </span>
              <span className="rv-stamp" style={{ "marginLeft": "auto", "color": "var(--carimbo)", "textShadow": "none", "fontSize": "12px" }}>
                {stamp}
              </span>
            </div>
          </div>
        </div>
        <div className="dots">
          {Array.from({ length: models }, (_, i) => (
            <i key={i} className={i + 1 === model ? "on" : undefined} role={onModel ? "button" : undefined} aria-label={onModel ? `Modelo ${i + 1}` : undefined} onClick={onModel ? () => onModel(i + 1) : undefined} style={onModel ? { "cursor": "pointer" } : undefined} />
          ))}
        </div>
        <div className="row" style={{ "gap": "8px", "marginTop": "18px" }}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ "flex": "1" }} onClick={onDownload}>
            <svg {...svgProps}>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            Baixar QR code
          </button>
        </div>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
