"use client";
/* Painel-convite-a5.html (17k): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { BackButton, QrSvg, ScreenFoot, svgProps } from "../painel-ui";

export interface PainelConviteA5Props {
  name?: string;
  date?: string;
  steps?: [string, string, string];
  code?: string;
  footer?: string;
  /** Matriz do QR real; ausente = o QR do desenho. */
  qr?: boolean[][];
  busy?: boolean;
  error?: string;
  onBack?: () => void;
  onPdf?: () => void;
  onPrint?: () => void;
}

export const CONVITE_A5_REF = {
  name: "Ana & Leo", date: "14 de março de 2027", steps: ["1 · Aponte a câmera", "2 · Escreva seu nome", "3 · 36 poses suas"] as [string, string, string], code: "TX5EVGS6", footer: "As fotos revelam domingo, 15 de março, ao meio-dia.",
};

export function PainelConviteA5({ name = CONVITE_A5_REF.name, date = CONVITE_A5_REF.date, steps = CONVITE_A5_REF.steps, code = CONVITE_A5_REF.code, footer = CONVITE_A5_REF.footer, qr, busy = false, error, onBack, onPdf, onPrint }: PainelConviteA5Props = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <BackButton onBack={onBack} />
          <h1 className="rv-title" style={{ "fontSize": "18px" }}>
            Convite A5
          </h1>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="grow" style={{ "display": "flex", "alignItems": "center", "justifyContent": "center" }}>
          <div className="a5">
            <div className="row" style={{ "gap": "8px", "justifyContent": "center" }}>
              <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="16" fill="var(--on-paper)" />
                <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
                <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
              </svg>
              <span style={{ "font": "400 15px/1 var(--font-display)" }}>
                revela
              </span>
            </div>
            <div className="a5-t">
              {name}
            </div>
            <div className="a5-s">
              {date}
            </div>
            <p className="a5-p">
              Fotografe a festa com a nossa câmera descartável.
            </p>
            <div style={{ "display": "flex", "justifyContent": "center" }}>
              <QrSvg size={128} modules={qr} />
            </div>
            <div className="a5-steps">
              <span>
                {steps[0]}
              </span>
              <span>
                {steps[1]}
              </span>
              <span>
                {steps[2]}
              </span>
            </div>
            <div className="a5-code">
              {"ou entre com o código "}
              <b>
                {code}
              </b>
            </div>
            <div className="a5-f">
              {footer}
            </div>
          </div>
        </div>
        {error && <p className="rv-caption center" role="alert" style={{ "color": "var(--danger)", "marginTop": "10px" }}>{error}</p>}
        <div className="row" style={{ "gap": "8px", "marginTop": "16px" }}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ "flex": "1" }} onClick={onPdf} disabled={busy}>
            <svg {...svgProps}>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            {busy ? "Gerando PDF…" : "Baixar PDF"}
          </button>
          <button type="button" className="rv-btn rv-btn--block" style={{ "flex": "1" }} onClick={onPrint}>
            <svg {...svgProps}>
              <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
            </svg>
            Imprimir
          </button>
        </div>
      </div>
      <ScreenFoot />
    </div>
    </>
  );
}
