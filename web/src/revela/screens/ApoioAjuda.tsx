"use client";
/* Gerado de design-system/revela/html/Apoio-ajuda.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface FaqView { id: string; q: string; a: string }
export const FAQ_REF: FaqView[] = [
  { id: "app", q: "Os convidados precisam baixar app?", a: "Não. Eles apontam a câmera do celular para o QR e a câmera do evento abre no navegador." },
  { id: "fotos", q: "Quando as fotos aparecem?", a: "" },
  { id: "plano", q: "Posso trocar de plano depois?", a: "" },
  { id: "apagar", q: "Como apago uma foto?", a: "" },
  { id: "pagamento", q: "O pagamento é seguro?", a: "" },
];

export interface ApoioAjudaProps {
  faqs?: FaqView[]; openId?: string | null; query?: string; supportHref?: string;
  onBack?: () => void; onQuery?: (q: string) => void; onToggle?: (id: string) => void;
}

export function ApoioAjuda({ faqs = FAQ_REF, openId = "app", query = "", supportHref, onBack, onQuery, onToggle }: ApoioAjudaProps = {}) {
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
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Ajuda
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <label className="rv-field" style={{ "marginTop": "16px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input value={query} onChange={(e) => onQuery?.(e.target.value)} placeholder="Buscar uma dúvida" aria-label="Buscar" />
        </label>
        <div className="faqs" style={{ overflowY: "auto", minHeight: 0 }}>
          {faqs.map((f) => (
            <div key={f.id} className={`faq${f.id === openId ? " open" : ""}`} data-testid={`faq-${f.id}`}>
              <div className="row between" role="button" tabIndex={0} aria-expanded={f.id === openId} style={{ cursor: "pointer" }} onClick={() => onToggle?.(f.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle?.(f.id); } }}>
                <b>
                  {f.q}
                </b>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </div>
              {f.id === openId && (
                <p>
                  {f.a}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="grow" />
        <a className="rv-btn rv-btn--block" style={{  }} href={supportHref}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />
          </svg>
          Falar com o suporte
        </a>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
