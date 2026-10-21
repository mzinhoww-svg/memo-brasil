"use client";

import { backendStatus } from "@/lib/supabase/env";

/** Aviso de modo local só quando o app realmente está local; servidor pedido e sem configuração vira erro visível. */
export function BackendNotice({ localText }: { localText: React.ReactNode }) {
  const status = backendStatus();
  if (status === "supabase") return null;
  if (status === "misconfigured") {
    return <p className="mm-field-erro" role="alert">Servidor indisponível: a configuração pública do Supabase está incompleta. Seus dados não estão sendo sincronizados.</p>;
  }
  return <p className="app-p app-muted">{localText}</p>;
}
