"use client";

import { backendMode, backendStatus } from "@/lib/supabase/env";

/** Aviso de modo local só quando o app realmente está local; servidor pedido e sem configuração vira erro visível. */
export function BackendNotice({ localText }: { localText: React.ReactNode }) {
  if (backendMode() === "supabase") return null;
  if (backendStatus() === "misconfigured") {
    return <p className="rv-field-erro rv-toast-in" role="alert">Servidor indisponível: a configuração pública do Supabase está incompleta. Seus dados não estão sendo sincronizados.</p>;
  }
  return <p className="app-p app-muted">{localText}</p>;
}
