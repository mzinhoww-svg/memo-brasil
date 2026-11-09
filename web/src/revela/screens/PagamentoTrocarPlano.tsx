/* Gerado de design-system/revela/html/Pagamento-trocar-plano.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PagamentoTrocarPlano() {
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
            Plano do evento
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="hero-ev" style={{ "marginTop": "14px" }}>
          <div className="row between">
            <span className="rv-caption">
              Plano atual
            </span>
            <span className="badge">
              Festa · R$ 29
            </span>
          </div>
          <div style={{ "marginTop": "14px" }} className="stack">
            <div className="gauge gauge--warn">
              <div className="row between">
                <span>
                  Convidados
                </span>
                <b>
                  28 de 30
                </b>
              </div>
              <i>
                <s style={{ "width": "93%" }} />
              </i>
            </div>
            <div className="gauge">
              <div className="row between">
                <span>
                  Poses por pessoa
                </span>
                <b>
                  24 de 24
                </b>
              </div>
              <i>
                <s style={{ "width": "100%" }} />
              </i>
            </div>
          </div>
          <p className="rv-caption" style={{ "marginTop": "12px", "color": "var(--carimbo)" }}>
            {"Faltam 2 lugares. Quem chegar depois vê \"câmera lotada\"."}
          </p>
        </div>
        <h2 className="rv-group-h">
          Aumentar para
        </h2>
        <div className="planscroll">
          <div className="rv-plans rv-plans--scroll" style={{ "transform": "translateX(-150px)" }}>
            <div className="rv-plan">
              <span className="rv-plan__tier">
                Grátis
              </span>
              <span className="rv-plan__price">
                Grátis
              </span>
              <span className="rv-plan__note">
                10 convidados
                <br />
                10 poses cada
              </span>
            </div>
            <div className="rv-plan">
              <span className="rv-plan__tier">
                Festa
              </span>
              <span className="rv-plan__price">
                R$ 29
              </span>
              <span className="rv-plan__note">
                30 convidados
                <br />
                24 poses cada
              </span>
            </div>
            <div className="rv-plan rv-plan--on">
              <span className="rv-plan__tier">
                Celebração
              </span>
              <span className="rv-plan__price">
                R$ 89
              </span>
              <span className="rv-plan__note">
                100 convidados
                <br />
                24 poses cada
              </span>
            </div>
            <div className="rv-plan">
              <span className="rv-plan__tier">
                Casamento
              </span>
              <span className="rv-plan__price">
                R$ 189
              </span>
              <span className="rv-plan__note">
                250 convidados
                <br />
                36 poses cada
              </span>
            </div>
            <div className="rv-plan rv-plan--gold">
              <span className="rv-plan__tier">
                Grande
              </span>
              <span className="rv-plan__price">
                R$ 349
              </span>
              <span className="rv-plan__note">
                500 convidados
                <br />
                poses livres
              </span>
            </div>
          </div>
        </div>
        <div className="grow" />
        <div className="paynote">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
          </svg>
          <span>
            Pix ou cartão, sem sair do app
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            ValidaPay
          </span>
        </div>
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Trocar para Celebração · R$ 89
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
