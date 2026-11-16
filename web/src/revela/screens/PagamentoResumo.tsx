"use client";
/* Gerado de design-system/revela/html/Pagamento-resumo.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface PagamentoResumoProps {
  cam?: string; planName?: string; caption?: string; price?: string; eventName?: string; priceExact?: string;
  method?: "pix" | "card"; /** Cartão só aparece com a chave validapay_card ligada. */ cardEnabled?: boolean;
  /** O provedor exige CPF/CNPJ no Pix; o desenho não tem o campo, então só aparece quando falta. */ askDocument?: boolean; document?: string; busy?: boolean; error?: string;
  onMethod?: (m: "pix" | "card") => void; onDocument?: (v: string) => void; onBack?: () => void; onPay?: () => void;
}

export function PagamentoResumo({
  cam = "/revela/ref/cam-casamento.webp", planName = "Casamento", caption = "250 convidados · 36 poses cada", price = "R$ 189", eventName = "Ana & Leo", priceExact = "R$ 189,00",
  method = "pix", cardEnabled = true, askDocument = false, document: doc = "", busy, error, onMethod, onDocument, onBack, onPay,
}: PagamentoResumoProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Pagamento
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="order">
          <div className="order-cam">
            <img src={cam} alt="" style={{ "width": "96px" }} />
          </div>
          <div style={{ "flex": "1" }}>
            <span className="rv-caption">
              Plano
            </span>
            <b className="order-t">
              {planName}
            </b>
            <span className="rv-caption">
              {caption}
            </span>
          </div>
          <div className="order-p">
            {price}
          </div>
        </div>
        <div className="rv-group" style={{ "marginTop": "14px" }}>
          <div className="rv-row">
            <div className="rv-row__text">
              {`Câmera ${eventName}`}
            </div>
            <span className="rv-row__end muted">
              {priceExact}
            </span>
          </div>
          <div className="rv-row">
            <div className="rv-row__text">
              <b>
                Total
              </b>
              <span className="rv-row__meta">
                Pagamento único, sem assinatura
              </span>
            </div>
            <span className="rv-row__end" style={{ "font": "400 24px/1 var(--font-display)", "color": "var(--ink)" }}>
              {price}
            </span>
          </div>
        </div>
        <h2 className="rv-group-h">
          Como você quer pagar?
        </h2>
        <div className={`paym${method === "pix" ? " on" : ""}`} role="radio" aria-checked={method === "pix"} aria-label="Pix" tabIndex={0} onClick={() => onMethod?.("pix")} style={{ cursor: "pointer" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
          </svg>
          <div>
            <b>
              Pix
            </b>
            <span>
              Libera na hora. QR ou copia e cola.
            </span>
          </div>
          <i className={`radio${method === "pix" ? " on" : ""}`} />
        </div>
        {cardEnabled && (<div className={`paym${method === "card" ? " on" : ""}`} role="radio" aria-checked={method === "card"} aria-label="Cartão de crédito" tabIndex={0} onClick={() => onMethod?.("card")} style={{ cursor: "pointer" }}>
          <div>
            <b>
              Cartão de crédito
            </b>
            <span>
              Visa, Mastercard, Elo. Confirmação pelo seu banco.
            </span>
          </div>
          <i className={`radio${method === "card" ? " on" : ""}`} />
        </div>)}
        {askDocument && method === "pix" && (<label className="rv-field" style={{ marginTop: "14px" }}><input value={doc} onChange={(e) => onDocument?.(e.target.value)} aria-label="CPF ou CNPJ" placeholder="CPF ou CNPJ" inputMode="numeric" autoComplete="off" /></label>)}
        {error && <p className="rv-caption" role="alert" style={{ color: "var(--danger)", marginTop: "10px" }}>{error}</p>}
        <div className="grow" />
        <p className="secure">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Processado pela ValidaPay. Os dados do cartão não passam pelo Revela.
        </p>
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onPay} disabled={busy}>
          {busy ? "Preparando…" : method === "pix" ? `Pagar ${price} com Pix` : `Pagar ${price} com cartão`}
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
