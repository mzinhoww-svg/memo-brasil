/* Gerado de design-system/revela/html/Painel-excluir.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PainelExcluir() {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="safe" style={{ "opacity": ".35" }}>
        <div className="row between">
          <button className="rv-icon-btn" aria-label="Voltar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Ajustes
          </span>
          <span style={{ "width": "44px" }} />
        </div>
      </div>
      <div className="sheet-full" style={{ "top": "auto", "height": "540px" }}>
        <div className="rv-sheet__grab" />
        <div className="bankico" style={{ "background": "var(--k-3a1414)", "color": "var(--danger)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </div>
        <h1 className="rv-title" style={{ "marginTop": "14px" }}>
          {"Excluir Ana & Leo?"}
        </h1>
        <p className="rv-caption" style={{ "marginTop": "6px" }}>
          As 418 fotos, os comentários e a lista de convidados somem para todo mundo. Não dá para desfazer. Baixe o ZIP antes.
        </p>
        <p className="rv-caption" style={{ "margin": "18px 0 8px" }}>
          Digite o nome do evento para confirmar
        </p>
        <label className="rv-field rv-field--focus">
          <input defaultValue="Ana & Le" aria-label="Nome do evento" />
        </label>
        <div className="grow" />
        <div className="stack">
          <button className="rv-btn rv-btn--block rv-btn--line" aria-disabled="true" style={{ "color": "var(--danger)" }}>
            Excluir para sempre
          </button>
          <button className="rv-btn rv-btn--block" style={{  }}>
            Encerrar o filme sem excluir
          </button>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
