/* Gerado de design-system/revela/html/Pagamento-aprovado.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface PagamentoAprovadoProps { cam?: string; message?: string; paid?: string; when?: string; onContinue?: () => void }

export function PagamentoAprovado({ cam = "/revela/ref/cam-casamento.webp", message = "A câmera de Ana & Leo está liberada para 250 convidados, com 36 poses cada.", paid = "Pix · R$ 189,00", when = "hoje, 08:42 · comprovante por e-mail", onContinue }: PagamentoAprovadoProps = {}) {
  return (
    <>
    <div className="scr">
      <img src="/revela/ref/obj-confetti.webp" alt="" style={{ "position": "absolute", "left": "-120px", "top": "-260px", "width": "620px", "opacity": ".9" }} />
      <div className="safe" style={{ "alignItems": "center", "textAlign": "center" }}>
        <div style={{ "marginTop": "150px" }}>
          <div className="rv-stagebox" style={{  }}>
            <img src={cam} alt="" style={{ "width": "280px" }} />
          </div>
        </div>
        <h1 className="rv-display" style={{ "marginTop": "4px" }}>
          Pago.
        </h1>
        <p className="rv-body muted" style={{ "margin": "10px 0 18px", "maxWidth": "300px" }}>
          {message}
        </p>
        <div className="rv-group">
          <div className="rv-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
            </svg>
            <div className="rv-row__text">
              {paid}
              <span className="rv-row__meta">
                {when}
              </span>
            </div>
            <span className="rv-row__end" style={{ "color": "var(--success)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
          </div>
        </div>
        <div className="grow" />
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onContinue}>
          Ver a câmera pronta
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
