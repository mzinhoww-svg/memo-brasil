import { Breadcrumbs, Button, Signature } from "@/components/revela";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/consent";
import { LEGAL_UPDATED_AT, type LegalSection } from "@/lib/legal-text";

/** Moldura das páginas legais (texto em lib/legal-text). Origem: texto fornecido pelo operador; sem revisão jurídica profissional registrada. */
export const isDraftVersion = (version: string): boolean => version.endsWith("-rascunho");

export function LegalPage({ title, kind, sections, version }: { title: string; kind: "terms" | "privacy"; sections: LegalSection[]; version?: string }) {
  const v = version ?? (kind === "terms" ? TERMS_VERSION : PRIVACY_VERSION);
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: title }]} />
        <h1 className="titulo-tela app-h1">{title}</h1>
        {isDraftVersion(v) && <p className="app-banner" role="note">Rascunho: este texto ainda não é a versão final.</p>}
        <p className="app-p app-muted">Versão: {v} · Atualização: {LEGAL_UPDATED_AT}</p>
        <div className="app-stack">
          {sections.map((s) => (
            <section key={s.title} className="app-stack-sm">
              <h2 className="titulo-card">{s.title}</h2>
              {s.blocks.map((b, i) => Array.isArray(b)
                ? <ul key={i} className="corpo app-p">{b.map((li) => <li key={li}>{li}</li>)}</ul>
                : <p key={i} className="corpo app-p">{b}</p>)}
            </section>
          ))}
        </div>
        <Button href="/" variant="texto">Voltar ao início</Button>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}
