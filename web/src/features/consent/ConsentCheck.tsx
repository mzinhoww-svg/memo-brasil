"use client";

import Link from "next/link";
import { useId } from "react";

const row = { display: "flex", gap: 12, alignItems: "flex-start", minHeight: 44, cursor: "pointer" } as const;
const box = { width: 24, height: 24, marginTop: 2, flex: "none" } as const;

/**
 * Duas confirmações separadas e SEMPRE desmarcadas ao abrir: aceite contratual dos Termos de Uso e ciência da Política de Privacidade
 * (a ciência não é consentimento genérico). A gravação no servidor é feita por `recordConsent` (lib/consent).
 */
export function ConsentChecks({ terms, privacy, onTerms, onPrivacy }: { terms: boolean; privacy: boolean; onTerms: (v: boolean) => void; onPrivacy: (v: boolean) => void }) {
  const a = useId();
  const b = useId();
  return (
    <div className="app-stack-sm">
      <label htmlFor={a} className="app-p" style={row}>
        <input id={a} type="checkbox" checked={terms} onChange={(e) => onTerms(e.target.checked)} style={box} />
        <span>Li e aceito os <Link href="/termos" target="_blank" rel="noopener">Termos de Uso</Link>.</span>
      </label>
      <label htmlFor={b} className="app-p" style={row}>
        <input id={b} type="checkbox" checked={privacy} onChange={(e) => onPrivacy(e.target.checked)} style={box} />
        <span>Li a <Link href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.</span>
      </label>
    </div>
  );
}

export const CONSENT_REQUIRED = "Aceite os Termos de Uso e confirme a leitura da Política de Privacidade para continuar.";
export const CONSENT_FAILED = "Não foi possível registrar o seu aceite. Tente de novo.";
