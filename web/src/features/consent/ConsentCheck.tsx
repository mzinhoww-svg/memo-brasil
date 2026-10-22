"use client";

import Link from "next/link";
import { useId } from "react";

/** Aceite explícito dos Termos de uso e da Política de privacidade. A gravação no servidor é feita por `recordConsent` (lib/consent). */
export function ConsentCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="app-p" style={{ display: "flex", gap: 12, alignItems: "flex-start", minHeight: 44, cursor: "pointer" }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 24, height: 24, marginTop: 2, flex: "none" }} />
      <span>
        Li e aceito os <Link href="/termos" target="_blank" rel="noopener">Termos de uso</Link> e a <Link href="/privacidade" target="_blank" rel="noopener">Política de privacidade</Link>.
      </span>
    </label>
  );
}

export const CONSENT_REQUIRED = "Aceite os Termos de uso e a Política de privacidade para continuar.";
export const CONSENT_FAILED = "Não foi possível registrar o seu aceite. Tente de novo.";
