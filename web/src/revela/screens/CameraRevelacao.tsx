/* Gerado de design-system/revela/html/Camera-revelacao.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function CameraRevelacao() {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full">
        <div className="rv-sheet__grab" />
        <div className="row between" style={{ "alignItems": "flex-start" }}>
          <div>
            <h1 className="rv-title">
              Quando revelar?
            </h1>
            <p className="rv-caption" style={{ "marginTop": "4px", "maxWidth": "290px" }}>
              Ninguém vê as fotos até a revelação. Nem quem tirou.
            </p>
          </div>
          <span className="rv-stamp" style={{ "fontSize": "12px", "marginTop": "6px" }}>
            5/8
          </span>
        </div>
        <div className="rv-steps">
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="" />
          <i className="" />
          <i className="" />
        </div>
        <div className="sheet-body">
          <div className="develop">
            <div className="rv-print" style={{ "width": "210px", "height": "262px", "transform": "rotate(-4deg)" }}>
              <div className="dev-img">
                <img src="/revela/ref/sc-pista.jpg" alt="Foto revelando" style={{  }} />
                <i />
              </div>
              <div className="rv-print__cap">
                <span>
                  {"'27 03 15"}
                </span>
                <span>
                  12:00
                </span>
              </div>
            </div>
          </div>
          <div className="rv-choices" style={{ "gridTemplateColumns": "1fr 1fr" }}>
            <button className="rv-choice">
              Ao fim do evento
            </button>
            <button className="rv-choice rv-choice--on">
              12h depois
            </button>
            <button className="rv-choice">
              24h depois
            </button>
            <button className="rv-choice">
              Eu escolho
            </button>
          </div>
          <p className="rv-caption center">
            Revela no domingo, 15 de março, às 12:00.
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
