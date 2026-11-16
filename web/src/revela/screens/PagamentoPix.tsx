/* Gerado de design-system/revela/html/Pagamento-pix.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface PagamentoPixProps {
  amount?: string; expires?: string; code?: string; copied?: boolean;
  /** QR Pix como data URL; ausente = o desenho. */
  qr?: string; onClose?: () => void; onCopy?: () => void;
}

export function PagamentoPix({ amount = "R$ 189", expires = "14:52", code = "00020126BR.GOV.BCB.PIX-EXEMPLO…", copied = false, qr, onClose, onCopy }: PagamentoPixProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div className="row between" style={{ "alignSelf": "stretch" }}>
          <button className="rv-icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span className="rv-stamp" style={{ "fontSize": "13px" }}>
            {`EXPIRA EM ${expires}`}
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <h1 className="rv-title-lg" style={{ "marginTop": "18px" }}>
          Pague {amount}
          <br />
          com Pix
        </h1>
        <div className="pixqr">
          {qr ? <img src={qr} alt="QR code Pix" width={200} height={200} /> : (<svg width="200" height="200" viewBox="0 0 33 33" role="img" aria-label="QR code do evento">
            <rect width="33" height="33" fill="var(--white-1)" />
            <path fill="var(--on-paper)" d="M2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM8 2h1v1h-1zM12 2h1v1h-1zM14 2h1v1h-1zM15 2h1v1h-1zM16 2h1v1h-1zM18 2h1v1h-1zM19 2h1v1h-1zM20 2h1v1h-1zM21 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM25 2h1v1h-1zM26 2h1v1h-1zM27 2h1v1h-1zM28 2h1v1h-1zM29 2h1v1h-1zM30 2h1v1h-1zM2 3h1v1h-1zM8 3h1v1h-1zM10 3h1v1h-1zM11 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM16 3h1v1h-1zM17 3h1v1h-1zM19 3h1v1h-1zM21 3h1v1h-1zM24 3h1v1h-1zM30 3h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM8 4h1v1h-1zM11 4h1v1h-1zM14 4h1v1h-1zM15 4h1v1h-1zM16 4h1v1h-1zM18 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM26 4h1v1h-1zM27 4h1v1h-1zM28 4h1v1h-1zM30 4h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM11 5h1v1h-1zM12 5h1v1h-1zM13 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM16 5h1v1h-1zM17 5h1v1h-1zM19 5h1v1h-1zM20 5h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM27 5h1v1h-1zM28 5h1v1h-1zM30 5h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM21 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h1v1h-1zM27 6h1v1h-1zM28 6h1v1h-1zM30 6h1v1h-1zM2 7h1v1h-1zM8 7h1v1h-1zM11 7h1v1h-1zM14 7h1v1h-1zM15 7h1v1h-1zM17 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM22 7h1v1h-1zM24 7h1v1h-1zM30 7h1v1h-1zM2 8h1v1h-1zM3 8h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM25 8h1v1h-1zM26 8h1v1h-1zM27 8h1v1h-1zM28 8h1v1h-1zM29 8h1v1h-1zM30 8h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM19 9h1v1h-1zM20 9h1v1h-1zM22 9h1v1h-1zM2 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM8 10h1v1h-1zM11 10h1v1h-1zM12 10h1v1h-1zM13 10h1v1h-1zM16 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM26 10h1v1h-1zM29 10h1v1h-1zM3 11h1v1h-1zM5 11h1v1h-1zM6 11h1v1h-1zM9 11h1v1h-1zM10 11h1v1h-1zM11 11h1v1h-1zM12 11h1v1h-1zM13 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM17 11h1v1h-1zM18 11h1v1h-1zM19 11h1v1h-1zM20 11h1v1h-1zM24 11h1v1h-1zM27 11h1v1h-1zM29 11h1v1h-1zM2 12h1v1h-1zM5 12h1v1h-1zM8 12h1v1h-1zM10 12h1v1h-1zM11 12h1v1h-1zM12 12h1v1h-1zM15 12h1v1h-1zM19 12h1v1h-1zM23 12h1v1h-1zM28 12h1v1h-1zM30 12h1v1h-1zM5 13h1v1h-1zM9 13h1v1h-1zM13 13h1v1h-1zM17 13h1v1h-1zM19 13h1v1h-1zM22 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM25 13h1v1h-1zM29 13h1v1h-1zM4 14h1v1h-1zM5 14h1v1h-1zM7 14h1v1h-1zM8 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM12 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM17 14h1v1h-1zM19 14h1v1h-1zM21 14h1v1h-1zM22 14h1v1h-1zM23 14h1v1h-1zM28 14h1v1h-1zM29 14h1v1h-1zM30 14h1v1h-1zM2 15h1v1h-1zM3 15h1v1h-1zM5 15h1v1h-1zM7 15h1v1h-1zM9 15h1v1h-1zM12 15h1v1h-1zM13 15h1v1h-1zM14 15h1v1h-1zM15 15h1v1h-1zM17 15h1v1h-1zM20 15h1v1h-1zM22 15h1v1h-1zM24 15h1v1h-1zM25 15h1v1h-1zM26 15h1v1h-1zM27 15h1v1h-1zM29 15h1v1h-1zM2 16h1v1h-1zM3 16h1v1h-1zM4 16h1v1h-1zM7 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM11 16h1v1h-1zM12 16h1v1h-1zM13 16h1v1h-1zM14 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1zM20 16h1v1h-1zM21 16h1v1h-1zM22 16h1v1h-1zM23 16h1v1h-1zM24 16h1v1h-1zM27 16h1v1h-1zM30 16h1v1h-1zM2 17h1v1h-1zM4 17h1v1h-1zM6 17h1v1h-1zM7 17h1v1h-1zM9 17h1v1h-1zM11 17h1v1h-1zM14 17h1v1h-1zM15 17h1v1h-1zM16 17h1v1h-1zM22 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM27 17h1v1h-1zM29 17h1v1h-1zM5 18h1v1h-1zM6 18h1v1h-1zM7 18h1v1h-1zM8 18h1v1h-1zM9 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM14 18h1v1h-1zM16 18h1v1h-1zM17 18h1v1h-1zM21 18h1v1h-1zM23 18h1v1h-1zM25 18h1v1h-1zM28 18h1v1h-1zM30 18h1v1h-1zM5 19h1v1h-1zM6 19h1v1h-1zM7 19h1v1h-1zM13 19h1v1h-1zM16 19h1v1h-1zM17 19h1v1h-1zM22 19h1v1h-1zM25 19h1v1h-1zM26 19h1v1h-1zM27 19h1v1h-1zM29 19h1v1h-1zM2 20h1v1h-1zM5 20h1v1h-1zM8 20h1v1h-1zM9 20h1v1h-1zM12 20h1v1h-1zM14 20h1v1h-1zM15 20h1v1h-1zM18 20h1v1h-1zM19 20h1v1h-1zM24 20h1v1h-1zM25 20h1v1h-1zM30 20h1v1h-1zM3 21h1v1h-1zM7 21h1v1h-1zM9 21h1v1h-1zM10 21h1v1h-1zM11 21h1v1h-1zM14 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM23 21h1v1h-1zM24 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM29 21h1v1h-1zM2 22h1v1h-1zM4 22h1v1h-1zM5 22h1v1h-1zM8 22h1v1h-1zM9 22h1v1h-1zM11 22h1v1h-1zM13 22h1v1h-1zM18 22h1v1h-1zM21 22h1v1h-1zM22 22h1v1h-1zM23 22h1v1h-1zM24 22h1v1h-1zM25 22h1v1h-1zM26 22h1v1h-1zM28 22h1v1h-1zM30 22h1v1h-1zM10 23h1v1h-1zM12 23h1v1h-1zM14 23h1v1h-1zM15 23h1v1h-1zM17 23h1v1h-1zM22 23h1v1h-1zM26 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM29 23h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM7 24h1v1h-1zM8 24h1v1h-1zM12 24h1v1h-1zM14 24h1v1h-1zM16 24h1v1h-1zM17 24h1v1h-1zM20 24h1v1h-1zM22 24h1v1h-1zM24 24h1v1h-1zM26 24h1v1h-1zM2 25h1v1h-1zM8 25h1v1h-1zM11 25h1v1h-1zM12 25h1v1h-1zM14 25h1v1h-1zM15 25h1v1h-1zM16 25h1v1h-1zM17 25h1v1h-1zM20 25h1v1h-1zM22 25h1v1h-1zM26 25h1v1h-1zM28 25h1v1h-1zM2 26h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM8 26h1v1h-1zM10 26h1v1h-1zM12 26h1v1h-1zM14 26h1v1h-1zM16 26h1v1h-1zM19 26h1v1h-1zM21 26h1v1h-1zM22 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM25 26h1v1h-1zM26 26h1v1h-1zM2 27h1v1h-1zM4 27h1v1h-1zM5 27h1v1h-1zM6 27h1v1h-1zM8 27h1v1h-1zM12 27h1v1h-1zM14 27h1v1h-1zM16 27h1v1h-1zM18 27h1v1h-1zM24 27h1v1h-1zM28 27h1v1h-1zM2 28h1v1h-1zM4 28h1v1h-1zM5 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM15 28h1v1h-1zM17 28h1v1h-1zM19 28h1v1h-1zM20 28h1v1h-1zM21 28h1v1h-1zM23 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM30 28h1v1h-1zM2 29h1v1h-1zM8 29h1v1h-1zM11 29h1v1h-1zM13 29h1v1h-1zM15 29h1v1h-1zM16 29h1v1h-1zM18 29h1v1h-1zM19 29h1v1h-1zM20 29h1v1h-1zM23 29h1v1h-1zM24 29h1v1h-1zM29 29h1v1h-1zM30 29h1v1h-1zM2 30h1v1h-1zM3 30h1v1h-1zM4 30h1v1h-1zM5 30h1v1h-1zM6 30h1v1h-1zM7 30h1v1h-1zM8 30h1v1h-1zM10 30h1v1h-1zM12 30h1v1h-1zM13 30h1v1h-1zM14 30h1v1h-1zM16 30h1v1h-1zM19 30h1v1h-1zM22 30h1v1h-1zM26 30h1v1h-1zM27 30h1v1h-1zM28 30h1v1h-1zM30 30h1v1h-1z" />
          </svg>)}
        </div>
        <span className="live" style={{ "marginTop": "4px" }}>
          <i />
          Aguardando o pagamento
        </span>
        <p className="rv-caption" style={{ "margin": "10px 0 0", "maxWidth": "290px" }}>
          No mesmo celular? Copie o código e cole na área Pix do app do seu banco. A câmera libera sozinha quando o banco confirmar.
        </p>
        <div className="grow" />
        <div className="linkbox" style={{ "alignSelf": "stretch" }}>
          <span>
            {code}
          </span>
        </div>
        <div style={{ "alignSelf": "stretch", "marginTop": "10px" }}>
          <button className="rv-btn rv-btn--block rv-btn--primary" onClick={onCopy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
            </svg>
            {copied ? "Código copiado" : "Copiar código Pix"}
          </button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
