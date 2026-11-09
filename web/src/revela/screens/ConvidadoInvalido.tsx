/* Gerado de design-system/revela/html/Convidado-invalido.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function ConvidadoInvalido() {
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
          <div className="rv-print rv-print--back" style={{ "position": "absolute", "left": "70px", "top": "20px", "width": "180px", "height": "225px", "transform": "rotate(5deg)", "zIndex": "1" }} />
          <span className="rv-stamp failstamp" style={{ "transform": "rotate(-8deg)" }}>
            VENCIDO
          </span>
        </div>
        <h1 className="rv-title-lg">
          Este convite
          <br />
          não vale mais
        </h1>
        <p className="rv-body muted" style={{ "margin": "12px 0 0", "maxWidth": "300px" }}>
          O link expirou ou foi trocado pelo anfitrião. Peça o QR novo para quem organizou a festa.
        </p>
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Digitar outro código
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
