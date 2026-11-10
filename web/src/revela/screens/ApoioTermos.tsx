"use client";
/* Gerado de design-system/revela/html/Apoio-termos.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface LegalBlockSection { title: string; blocks: (string | string[])[] }
export const TERMOS_REF: LegalBlockSection[] = [
  { title: "O que guardamos", blocks: ["Seu nome, as fotos que você tira e, se você quiser, seu e-mail para o aviso de revelação."] },
  { title: "Quem vê suas fotos", blocks: ["Ninguém antes da revelação. Depois, os convidados do evento, se o anfitrião deixar o feed aberto."] },
  { title: "Por quanto tempo", blocks: ["As fotos ficam 12 meses depois da revelação. Você pode apagar seus dados a qualquer momento em Você."] },
  { title: "Fale com a gente", blocks: ["privacidade@revela.app"] },
];

export interface ApoioTermosProps {
  tab?: "terms" | "privacy"; stamp?: string; note?: string; sections?: LegalBlockSection[];
  onBack?: () => void; onTab?: (tab: "terms" | "privacy") => void;
}

export function ApoioTermos({ tab = "privacy", stamp = "ATUALIZADO EM 09 NOV 2026", note, sections = TERMOS_REF, onBack, onTab }: ApoioTermosProps = {}) {
  const seg = (k: "terms" | "privacy") => (onTab ? { role: "tab" as const, tabIndex: 0, "aria-selected": tab === k, style: { cursor: "pointer" }, onClick: () => onTab(k), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTab(k); } } } : {});
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
            {tab === "terms" ? "Termos" : "Privacidade"}
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div style={{ "marginTop": "14px" }}>
          <div className="seg" role={onTab ? "tablist" : undefined} aria-label="Documento">
            <span className={tab === "terms" ? "on" : ""} {...seg("terms")}>
              Termos
            </span>
            <span className={tab === "privacy" ? "on" : ""} {...seg("privacy")}>
              Privacidade
            </span>
          </div>
        </div>
        <p className="rv-stamp" style={{ "marginTop": "22px", "marginBottom": "12px", "fontSize": "12px" }}>
          {stamp}
        </p>
        <div className="legal" tabIndex={0} role="region" aria-label="Texto do documento" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {note && <p role="note">{note}</p>}
          {sections.map((sec) => (
            <div key={sec.title}>
              <h2>
                {sec.title}
              </h2>
              {sec.blocks.map((blk, i) => Array.isArray(blk)
                ? <ul key={i} style={{ margin: 0, paddingLeft: "20px", font: "400 16px/24px var(--font-sans)", color: "var(--ink-muted)" }}>{blk.map((li) => <li key={li}>{li}</li>)}</ul>
                : <p key={i} style={i ? { marginTop: "10px" } : undefined}>
                  {blk}
                </p>)}
            </div>
          ))}
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
