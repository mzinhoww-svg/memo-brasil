/* Gerado de design-system/revela/html/Painel-aviso.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export function PainelAviso() {
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
            Novo aviso
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <label className="rv-field rv-field--focus area" style={{ "marginTop": "16px" }}>
          <textarea aria-label="Mensagem" defaultValue={"O bolo vai ser cortado às 22:30. Guardem umas poses para esse momento!"} />
        </label>
        <p className="rv-caption" style={{ "textAlign": "right", "marginTop": "6px" }}>
          71/140
        </p>
        <h2 className="rv-group-h">
          Quando enviar
        </h2>
        <div className="seg">
          <span className="">
            Agora
          </span>
          <span className="on">
            Agendar
          </span>
        </div>
        <div className="rv-group" style={{ "marginTop": "10px" }}>
          <div className="rv-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <div className="rv-row__text">
              <span className="rv-row__meta">
                Envia
              </span>
              sáb, 14 mar, 22:15
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
        <h2 className="rv-group-h">
          Prévia
        </h2>
        <div className="lk-note" style={{ "background": "var(--surface-2)" }}>
          <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="16" fill="var(--surface-1)" />
            <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
            <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="lk-h">
              <b>
                {"Ana & Leo"}
              </b>
              <span>
                22:15
              </span>
            </div>
            <div className="lk-b">
              O bolo vai ser cortado às 22:30. Guardem umas poses para esse momento!
            </div>
          </div>
        </div>
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
          Agendar aviso
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
