/* Gerado de design-system/revela/html/Painel-moderacao.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PainelModeracao() {
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
            Moderação
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div style={{ "marginTop": "14px" }}>
          <div className="seg">
            <span className="">
              Fotos
            </span>
            <span className="on">
              Comentários 2
            </span>
            <span className="">
              Bloqueados
            </span>
          </div>
        </div>
        <div className="stack" style={{ "marginTop": "16px" }}>
          <div className="modc">
            <img src="/revela/ref/sc-pista.jpg" alt="" style={{  }} />
            <div style={{ "flex": "1" }}>
              <div className="row between">
                <b>
                  Primo Jorge
                </b>
                <span className="rv-caption" style={{ "color": "var(--danger)" }}>
                  3 denúncias
                </span>
              </div>
              <p>
                Essa aí da gravata já tava passando mal kkkk
              </p>
              <div className="row" style={{ "gap": "8px" }}>
                <button className="rv-btn rv-btn--sm">
                  Manter
                </button>
                <button className="rv-btn rv-btn--sm" style={{ "color": "var(--danger)" }}>
                  Esconder
                </button>
              </div>
            </div>
          </div>
          <div className="modc">
            <img src="/revela/ref/sc-brinde.jpg" alt="" style={{  }} />
            <div style={{ "flex": "1" }}>
              <div className="row between">
                <b>
                  Convidado sem nome
                </b>
                <span className="rv-caption" style={{ "color": "var(--danger)" }}>
                  1 denúncias
                </span>
              </div>
              <p>
                Quem trouxe esse cara?
              </p>
              <div className="row" style={{ "gap": "8px" }}>
                <button className="rv-btn rv-btn--sm">
                  Manter
                </button>
                <button className="rv-btn rv-btn--sm" style={{ "color": "var(--danger)" }}>
                  Esconder
                </button>
              </div>
            </div>
          </div>
        </div>
        <h2 className="rv-group-h">
          Comentários
        </h2>
        <div className="rv-group">
          <div className="rv-row">
            <div className="rv-row__text">
              Comentários ligados
            </div>
            <span className="rv-toggle rv-toggle--on" />
          </div>
          <div className="rv-row">
            <div className="rv-row__text">
              Esconder ao receber 3 denúncias
            </div>
            <span className="rv-toggle rv-toggle--on" />
          </div>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
