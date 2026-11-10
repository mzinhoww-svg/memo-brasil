"use client";

import { useRouter } from "next/navigation";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/consent";
import { LEGAL_UPDATED_AT, type LegalSection } from "@/lib/legal-text";
import { ApoioTermos } from "@/revela/screens/ApoioTermos";

/** 31 · Termos e privacidade (texto em lib/legal-text). Origem: texto fornecido pelo operador; sem revisão jurídica profissional registrada. */
export const isDraftVersion = (version: string): boolean => version.endsWith("-rascunho");

export function LegalPage({ title, kind, sections, version }: { title: string; kind: "terms" | "privacy"; sections: LegalSection[]; version?: string }) {
  const router = useRouter();
  const v = version ?? (kind === "terms" ? TERMS_VERSION : PRIVACY_VERSION);
  return (
    <main aria-label={title}>
      <ApoioTermos
        tab={kind} sections={sections}
        stamp={`ATUALIZADO EM ${LEGAL_UPDATED_AT.toUpperCase()} · VERSÃO ${v.toUpperCase()}`}
        note={isDraftVersion(v) ? "Rascunho: este texto ainda não é a versão final." : undefined}
        onBack={() => router.back()} onTab={(t) => router.replace(t === "terms" ? "/termos" : "/privacidade")}
      />
    </main>
  );
}
