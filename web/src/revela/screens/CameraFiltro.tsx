/* Gerado de design-system/revela/html/Camera-filtro.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function CameraFiltro() {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full">
        <div className="rv-sheet__grab" />
        <div className="row between" style={{ "alignItems": "flex-start" }}>
          <div>
            <h1 className="rv-title">
              Qual filme?
            </h1>
            <p className="rv-caption" style={{ "marginTop": "4px", "maxWidth": "290px" }}>
              O filme é aplicado em todas as fotos. Dá para tirar depois.
            </p>
          </div>
          <span className="rv-stamp" style={{ "fontSize": "12px", "marginTop": "6px" }}>
            6/8
          </span>
        </div>
        <div className="rv-steps">
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="" />
          <i className="" />
        </div>
        <div className="sheet-body">
          <div className="compare">
            <div className="cmp">
              <img src="/revela/ref/sc-bolo-natural.jpg" alt="Sem filme" style={{  }} />
              <span>
                Natural
              </span>
            </div>
            <div className="cmp on">
              <img src="/revela/ref/sc-bolo.jpg" alt="Com filme 35mm" style={{  }} />
              <span>
                Filme 35mm
              </span>
            </div>
          </div>
          <p className="rv-caption center">
            Filme 35mm: tons quentes, grão, carimbo de data e o brilho do flash.
          </p>
        </div>
        <div className="cta-bar">
          <button className="rv-icon-btn" aria-label="Voltar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="rv-btn rv-btn--primary">
            Próximo
          </button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
