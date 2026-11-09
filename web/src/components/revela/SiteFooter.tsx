"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPublicSettings } from "@/features/billing/api";
import type { PublicSettings } from "@/features/billing/types";
import { CONTACT_EMAIL } from "@/lib/contact";
import { Signature } from "./Signature";

/** Só nas rotas públicas; o app do convidado e o painel ficam sem rodapé. */
const PUBLIC_PATHS = new Set(["/", "/precos", "/ajuda", "/termos", "/privacidade"]);

/** Contato público: e-mail de `get_public_settings()`; padrão do projeto quando vazio ou indisponível. */
export const contactFrom = (s: PublicSettings | null): string => s?.supportEmail || CONTACT_EMAIL;

export function SiteFooter() {
  const path = usePathname();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const show = PUBLIC_PATHS.has(path ?? "");
  useEffect(() => {
    if (!show) return;
    let alive = true;
    void getPublicSettings().then((s) => { if (alive) setSettings(s); }, () => undefined);
    return () => { alive = false; };
  }, [show]);
  if (!show) return null;
  const mail = contactFrom(settings);
  const company = [settings?.companyLegalName, settings?.companyCnpj ? `CNPJ ${settings.companyCnpj}` : null].filter(Boolean).join(" · ");
  return (
    <footer className="app-col app-col--card app-fluid rv-rodape" aria-label="Rodapé">
      <nav className="app-row" aria-label="Links do rodapé" style={{ flexWrap: "wrap", gap: "var(--space-4)", justifyContent: "center" }}>
        <Link href="/precos" className="rv-link">Preços</Link>
        <Link href="/termos" className="rv-link">Termos</Link>
        <Link href="/privacidade" className="rv-link">Privacidade</Link>
        <Link href="/ajuda" className="rv-link">Ajuda</Link>
        <a href={`mailto:${mail}`} className="rv-link">{mail}</a>
      </nav>
      {company && <p className="meta app-muted" style={{ textAlign: "center" }}>{company}</p>}
      <div style={{ display: "flex", justifyContent: "center", paddingBlock: "var(--space-4)" }}><Signature /></div>
    </footer>
  );
}
