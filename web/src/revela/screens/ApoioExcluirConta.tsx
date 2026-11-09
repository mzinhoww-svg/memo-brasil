"use client";
/* Gerado de design-system/revela/html/Apoio-excluir-conta.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface ApoioExcluirContaProps {
  eventsLabel?: string; busy?: boolean; error?: string;
  onBack?: () => void; onDownload?: () => void; onDelete?: () => void; onCancel?: () => void;
}

export function ApoioExcluirConta({ eventsLabel = "2 eventos serão excluídos", busy, error, onBack, onDownload, onDelete, onCancel }: ApoioExcluirContaProps = {}) {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="safe" style={{ "opacity": ".35" }}>
        <div className="row between">
          <button className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Você
          </span>
          <span style={{ "width": "44px" }} />
        </div>
      </div>
      <div className="sheet-full" style={{ "top": "auto", "height": "500px" }}>
        <div className="rv-sheet__grab" />
        <h1 className="rv-title">
          Excluir sua conta
        </h1>
        <p className="rv-caption" style={{ "marginTop": "6px" }}>
          Seus eventos e as fotos que você tirou são apagados em até 30 dias. Pagamentos ficam registrados como exige a lei.
        </p>
        <div className="rv-group" style={{ "marginTop": "16px" }}>
          <div className="rv-row" {...(onDownload ? { role: "button" as const, tabIndex: 0, style: { cursor: "pointer" }, onClick: onDownload, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDownload(); } } } : {})}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            <div className="rv-row__text">
              Baixar meus dados antes
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
            </svg>
            <div className="rv-row__text">
              {eventsLabel}
            </div>
          </div>
        </div>
        {error && <p className="rv-caption center" role="alert" style={{ color: "var(--danger)", marginTop: "10px" }}>{error}</p>}
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--line" style={{ "color": "var(--danger)" }} disabled={busy} onClick={onDelete}>
          Excluir minha conta
        </button>
        <button className="rv-btn rv-btn--block" style={{ "marginTop": "10px" }} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
