/* Gerado de design-system/revela/html/Cadastro-perfil.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function CadastroPerfil() {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <button className="rv-icon-btn" aria-label="Voltar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="rv-title-lg" style={{ "marginTop": "36px" }}>
          Como te chamam
          <br />
          na festa?
        </h1>
        <p className="rv-body muted" style={{ "margin": "10px 0 24px" }}>
          Seu nome sai no verso de cada foto que você tirar.
        </p>
        <div className="row" style={{ "gap": "16px", "marginBottom": "18px" }}>
          <button className="avatar" aria-label="Adicionar foto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <div className="rv-caption">
            Foto de perfil
            <br />
            <span style={{ "color": "var(--revela-text)", "fontWeight": "600" }}>
              Adicionar
            </span>
          </div>
        </div>
        <label className="rv-field rv-field--focus">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <input defaultValue="Ana Ribeiro" aria-label="Nome" />
        </label>
        <div className="pv-back">
          <div className="pv-label">
            Verso da foto
          </div>
          <div className="pv-card">
            <span className="rv-stamp" style={{ "color": "var(--carimbo)", "textShadow": "none" }}>
              {"'27 03 14"}
            </span>
            <span style={{ "font": "500 13px/1 var(--font-sans)", "color": "var(--k-4a4039)" }}>
              por Ana Ribeiro
            </span>
          </div>
        </div>
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Continuar
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
