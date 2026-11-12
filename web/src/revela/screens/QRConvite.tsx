"use client";
/* QR-convite.html (25): markup da referência; um cartão por modelo num carrossel de rolagem nativa; dados reais por props (padrão = desenho). */
import { useState } from "react";
import { Carousel } from "../Carousel";
import { BackButton, QrSvg, ScreenFoot, svgProps } from "../painel-ui";

export interface QRConviteProps {
  name?: string;
  date?: string;
  copy?: string;
  /** Texto de cada modelo (um cartão por modelo); ausente = `copy` em todos. */
  copies?: string[];
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
  /** Recebe o modelo ativo (1 a `models`). */
  onDownload?: (model: number) => void;
}

export const QR_CONVITE_REF = {
  name: "Ana & Leo", date: "14 de março de 2027", stamp: "REVELA DOM 12:00",
  copy: "Aponte a câmera do celular para o código, pegue a câmera do casamento e fotografe a festa pelo seu olhar. Você tem 27 poses.",
};

interface TableCardProps { name: string; date: string; copy: string; stamp: string; qr?: boolean[][]; square: boolean; withQr: boolean }

function TableCard({ name, date, copy, stamp, qr, square, withQr }: TableCardProps) {
  return (
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
        {withQr ? <QrSvg size={96} modules={qr} /> : <span style={{ "width": "96px", "height": "96px", "flex": "none" }} aria-hidden="true" />}
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
  );
}

export function QRConvite({ name = QR_CONVITE_REF.name, date = QR_CONVITE_REF.date, copy = QR_CONVITE_REF.copy, copies, stamp = QR_CONVITE_REF.stamp, model = 2, models = 4, qr, square = false, onClose, onRatio, onModel, onDownload }: QRConviteProps = {}) {
  // modelo mostrado: segue a prop `model` quando ela muda e a rolagem quando a pessoa desliza
  const [shown, setShown] = useState(model);
  const [seen, setSeen] = useState(model);
  if (model !== seen) { setSeen(model); setShown(model); }
  const pick = (i: number) => { setShown(i + 1); onModel?.(i + 1); };

  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onClose} label="Fechar" close />
          <span className="rv-caption" aria-live="polite">
            {`Modelo ${shown} de ${models}`}
          </span>
          <button type="button" className="rv-icon-btn cx-ratio" aria-label={`Proporção: ${square ? "quadrado" : "retrato"}`} onClick={onRatio}>
            <svg {...svgProps}>
              {square ? <rect x="5" y="5" width="14" height="14" rx="2" /> : <rect x="6" y="3" width="12" height="18" rx="2" />}
            </svg>
            <span>{square ? "Quadrado" : "Retrato"}</span>
          </button>
        </div>
        <div className="grow" style={{ "display": "flex", "alignItems": "center" }}>
          <Carousel count={models} index={shown - 1} onIndexChange={pick} label="Modelos do cartão de mesa" trackLabel="Modelos do cartão de mesa">
            {Array.from({ length: models }, (_, i) => (
              <div key={i} className="cx-slide" role="group" aria-roledescription="slide" aria-label={`Modelo ${i + 1} de ${models}`}>
                <TableCard name={name} date={date} copy={copies?.[i] ?? copy} stamp={stamp} qr={qr} square={square} withQr={Math.abs(i + 1 - shown) <= 1} />
              </div>
            ))}
          </Carousel>
        </div>
        <div className="row" style={{ "gap": "8px", "marginTop": "18px" }}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ "flex": "1" }} onClick={() => onDownload?.(shown)}>
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
