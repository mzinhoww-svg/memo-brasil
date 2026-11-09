/* Gerado de design-system/revela/html/Pagamento-falhou.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PagamentoFalhou() {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div className="row between" style={{ "alignSelf": "stretch" }}>
          <button className="rv-icon-btn" aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <span />
        </div>
        <div className="failviz">
          <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "40px", "top": "20px", "width": "170px", "height": "215px", "transform": "rotate(-6deg)", "zIndex": "1" }} />
          <span className="rv-stamp failstamp">
            RECUSADO
          </span>
        </div>
        <h1 className="rv-title-lg">
          O banco recusou
        </h1>
        <p className="rv-body muted" style={{ "margin": "12px 0 0", "maxWidth": "300px" }}>
          O cartão final 4417 não foi aprovado. Nada foi cobrado. Tente com Pix ou com outro cartão.
        </p>
        <div className="grow" />
        <div className="stack" style={{ "alignSelf": "stretch" }}>
          <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
            </svg>
            Pagar com Pix
          </button>
          <button className="rv-btn rv-btn--block" style={{  }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M2.5 10h19M6 15h4" />
            </svg>
            Usar outro cartão
          </button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
