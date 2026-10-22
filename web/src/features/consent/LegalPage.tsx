import type { ReactNode } from "react";
import { Breadcrumbs, Button, Signature } from "@/components/memoriesmt";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/consent";

/** Moldura das páginas legais. Texto em rascunho até a revisão jurídica (COM-004). */
export function LegalPage({ title, kind, children }: { title: string; kind: "terms" | "privacy"; children: ReactNode }) {
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-screen">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: title }]} />
        <h1 className="titulo-tela app-h1">{title}</h1>
        <div className="app-banner" role="note">
          <span>Rascunho em revisão jurídica. Versão {kind === "terms" ? TERMS_VERSION : PRIVACY_VERSION}. O texto pode mudar antes da versão final.</span>
        </div>
        <div className="app-stack">{children}</div>
        <Button href="/" variant="texto">Voltar ao início</Button>
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}
