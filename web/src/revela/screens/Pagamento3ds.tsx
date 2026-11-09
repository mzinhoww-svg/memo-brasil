/* Gerado de design-system/revela/html/Pagamento-3ds.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function Pagamento3ds() {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="safe" style={{ "opacity": ".35" }}>
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
        <div className="ccard" style={{ "marginTop": "18px" }} />
      </div>
      <div className="sheet-full" style={{ "top": "auto", "height": "470px", "alignItems": "center", "textAlign": "center" }}>
        <div className="rv-sheet__grab" />
        <div className="bankico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
        </div>
        <h1 className="rv-title" style={{ "marginTop": "16px" }}>
          Confirme no app do banco
        </h1>
        <p className="rv-caption" style={{ "marginTop": "8px", "maxWidth": "290px" }}>
          Seu banco pediu uma verificação para esta compra de R$ 189. Abra o app dele, aprove e volte aqui.
        </p>
        <div className="spinner" style={{ "marginTop": "26px" }} />
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Já aprovei
        </button>
        <button className="rv-btn rv-btn--text rv-btn--block">
          Pagar com Pix
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
