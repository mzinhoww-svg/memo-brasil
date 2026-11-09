/* Gerado de design-system/revela/html/Pagamento-resumo.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PagamentoResumo() {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <button className="rv-icon-btn" aria-label="Voltar">
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
            <img src="/revela/ref/cam-casamento.webp" alt="" style={{ "width": "96px" }} />
          </div>
          <div style={{ "flex": "1" }}>
            <span className="rv-caption">
              Plano
            </span>
            <b className="order-t">
              Casamento
            </b>
            <span className="rv-caption">
              250 convidados · 36 poses cada
            </span>
          </div>
          <div className="order-p">
            R$ 189
          </div>
        </div>
        <div className="rv-group" style={{ "marginTop": "14px" }}>
          <div className="rv-row">
            <div className="rv-row__text">
              {"Câmera Ana & Leo"}
            </div>
            <span className="rv-row__end muted">
              R$ 189,00
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
              R$ 189
            </span>
          </div>
        </div>
        <h2 className="rv-group-h">
          Como você quer pagar?
        </h2>
        <div className="paym on">
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
          <i className="radio on" />
        </div>
        <div className="paym">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="M2.5 10h19M6 15h4" />
          </svg>
          <div>
            <b>
              Cartão de crédito
            </b>
            <span>
              Visa, Mastercard, Elo. Confirmação pelo seu banco.
            </span>
          </div>
          <i className="radio" />
        </div>
        <div className="grow" />
        <p className="secure">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          Processado pela ValidaPay. Os dados do cartão não passam pelo Revela.
        </p>
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Pagar R$ 189 com Pix
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
