"use client";
/* Gerado de design-system/revela/html/Apoio-precos.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface PrecoView { code: string; name: string; line: string; price: string; on?: boolean }
export const PRECOS_REF: PrecoView[] = [
  { code: "gratis", name: "Até 10 convidados", line: "10 poses por convidado", price: "Grátis" },
  { code: "ate150", name: "Até 150 convidados", line: "36 poses por convidado", price: "R$ 147", on: true },
  { code: "ate300", name: "Até 300 convidados", line: "36 poses por convidado", price: "R$ 297" },
];

export interface ApoioPrecosProps { plans?: PrecoView[]; payNote?: string; payProvider?: string; salesHref?: string; onBack?: () => void; onNext?: () => void }

export function ApoioPrecos({ plans = PRECOS_REF, payNote = "Pix ou cartão, sem sair do app", payProvider = "ValidaPay", salesHref, onBack, onNext }: ApoioPrecosProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <button className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span style={{ "width": "44px" }} />
        </div>
        <h1 className="rv-display" style={{ "fontSize": "44px", "lineHeight": "46px", "marginTop": "14px" }}>
          Quantos convidados vão à festa?
        </h1>
        <p className="rv-body muted" style={{ "margin": "10px 0 20px" }}>
          Pagamento único por evento, sem assinatura. Convidados não pagam nada e não precisam baixar app.
        </p>
        <div className="stack" style={{ "gap": "8px" }}>
          {plans.map((p) => (
            <div key={p.code} className={`pplan${p.on ? " on" : ""}`} data-testid={`preco-${p.code}`}>
              <div>
                <b>
                  {p.name}
                </b>
                <span>
                  {p.line}
                </span>
              </div>
              <strong>
                {p.price}
              </strong>
            </div>
          ))}
        </div>
        {salesHref && <a className="rv-link" href={salesHref} target="_blank" rel="noopener noreferrer" style={{ "display": "inline-block", "marginTop": "16px" }}>Mais de 300 convidados? Fale no WhatsApp</a>}
        <div className="paynote" style={{ "marginTop": "16px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
          </svg>
          <span>
            {payNote}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            {payProvider}
          </span>
        </div>
        <div className="grow" />
        <button className="rv-btn rv-btn--block rv-btn--primary" style={{  }} onClick={onNext}>
          Criar evento grátis
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
