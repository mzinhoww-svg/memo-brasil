/* Gerado de design-system/revela/html/Cadastro-telefone.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function CadastroTelefone() {
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
          Qual é o seu
          <br />
          número?
        </h1>
        <p className="rv-body muted" style={{ "margin": "10px 0 24px" }}>
          Mandamos um código por SMS. Seu número não aparece para ninguém.
        </p>
        <div className="row" style={{ "gap": "8px" }}>
          <div className="rv-field" style={{ "width": "92px", "justifyContent": "center" }}>
            +55
          </div>
          <label className="rv-field rv-field--focus" style={{ "flex": "1" }}>
            <input defaultValue="(65) 99812-40" aria-label="Telefone" />
          </label>
        </div>
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          Enviar código
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
