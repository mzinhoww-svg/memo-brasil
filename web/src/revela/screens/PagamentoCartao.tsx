/* Gerado de design-system/revela/html/Pagamento-cartao.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PagamentoCartao() {
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
            Cartão de crédito
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="ccard">
          <div className="row between">
            <span className="ccard-chip" />
            <span className="rv-stamp" style={{ "color": "var(--carimbo)", "textShadow": "none", "fontSize": "12px" }}>
              R$ 189
            </span>
          </div>
          <div className="ccard-n">
            5234 •••• •••• 4417
          </div>
          <div className="row between">
            <span>
              BIA MORAES
            </span>
            <span>
              08/29
            </span>
          </div>
        </div>
        <label className="rv-field rv-field--focus" style={{ "marginTop": "18px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="M2.5 10h19M6 15h4" />
          </svg>
          <input defaultValue="5234 8812 0093 4417" aria-label="Número do cartão" />
        </label>
        <div className="row" style={{ "gap": "8px", "marginTop": "10px" }}>
          <label className="rv-field" style={{ "flex": "1" }}>
            <input defaultValue="08/29" aria-label="Validade" />
          </label>
          <label className="rv-field" style={{ "flex": "1" }}>
            <input defaultValue="•••" aria-label="CVV" />
          </label>
        </div>
        <label className="rv-field" style={{ "marginTop": "10px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <input defaultValue="Bia Moraes" aria-label="Nome no cartão" />
        </label>
        <label className="rv-field" style={{ "marginTop": "10px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
          <input defaultValue="123.456.789-09" aria-label="CPF" />
        </label>
        <div className="grow" />
        <p className="secure">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          O número vira um token no seu aparelho. Seu banco pode pedir uma confirmação.
        </p>
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Pagar R$ 189
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
