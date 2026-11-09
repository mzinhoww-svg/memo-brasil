/* Gerado de design-system/revela/html/Camera-privacidade.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function CameraPrivacidade() {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full">
        <div className="rv-sheet__grab" />
        <div className="row between" style={{ "alignItems": "flex-start" }}>
          <div>
            <h1 className="rv-title">
              Quem vê o quê
            </h1>
            <p className="rv-caption" style={{ "marginTop": "4px", "maxWidth": "290px" }}>
              Você vê tudo e pode tirar qualquer foto antes da revelação.
            </p>
          </div>
          <span className="rv-stamp" style={{ "fontSize": "12px", "marginTop": "6px" }}>
            7/8
          </span>
        </div>
        <div className="rv-steps">
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="on" />
          <i className="" />
        </div>
        <div className="sheet-body">
          <div className="privviz">
            <div className="rv-print" style={{ "position": "absolute", "left": "30px", "top": "10px", "width": "120px", "height": "150px", "transform": "rotate(-7deg)", "zIndex": "1" }}>
              <img src="/revela/ref/sc-baloes.jpg" alt="Foto de convidado" style={{  }} />
            </div>
            <div className="rv-print" style={{ "position": "absolute", "left": "130px", "top": "0px", "width": "120px", "height": "150px", "transform": "rotate(4deg)", "zIndex": "2" }}>
              <img src="/revela/ref/sc-aliancas.jpg" alt="Foto de convidado" style={{  }} />
            </div>
            <div className="rv-print" style={{ "position": "absolute", "left": "232px", "top": "16px", "width": "120px", "height": "150px", "transform": "rotate(-2deg)", "zIndex": "1" }}>
              <img src="/revela/ref/sc-camera.jpg" alt="Foto de convidado" style={{  }} />
            </div>
          </div>
          <div className="rv-group">
            <div className="rv-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <div className="rv-row__text">
                Convidados veem o feed
                <span className="rv-row__meta">
                  Curtem e comentam depois da revelação
                </span>
              </div>
              <span className="rv-toggle rv-toggle--on" />
            </div>
            <div className="rv-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              <div className="rv-row__text">
                Permitir baixar em alta
              </div>
              <span className="rv-toggle rv-toggle--on" />
            </div>
          </div>
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
