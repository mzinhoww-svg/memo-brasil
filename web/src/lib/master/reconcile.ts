/** "Conciliar agora" (M05): Edge Function `payments-reconcile-now`. O banco exige Master com segundo fator (aal2); o token da conciliação nunca sai do servidor. */
import { browserSupabase } from "@/lib/supabase/client";

export type ReconcileOutcome =
  | { kind: "ok"; confirmed: number; failed: number; unchanged?: number; failures?: { label: string; message: string }[] }
  | { kind: "stepup" | "ratelimited" | "forbidden" | "unavailable" };

export function reconcileText(o: ReconcileOutcome): string {
  switch (o.kind) {
    case "ok": return o.confirmed + o.failed === 0 ? "Conciliação feita: nada pendente no provedor." : `Conciliação feita: ${o.confirmed} confirmados${o.failed ? `, ${o.failed} com falha (a rotina tenta de novo)` : ""}.`;
    case "stepup": return "Confirme a identidade em duas etapas para conciliar.";
    case "ratelimited": return "A conciliação já foi pedida há pouco. Espere um minuto.";
    case "forbidden": return "Sem permissão para conciliar.";
    default: return "Pedido registrado, mas a conciliação imediata está indisponível. A rotina automática confirma em até 5 minutos.";
  }
}

async function errorBody(e: unknown): Promise<string | undefined> {
  try {
    const b = await (e as { context?: Response }).context?.json();
    return typeof b?.error === "string" ? b.error : undefined;
  } catch { return undefined; }
}

export async function reconcileNow(): Promise<ReconcileOutcome> {
  const r = await browserSupabase().functions.invoke("payments-reconcile-now", { body: {} });
  if (r.error) {
    const code = await errorBody(r.error);
    return { kind: code === "stepup" ? "stepup" : code === "ratelimited" ? "ratelimited" : code === "forbidden" || code === "unauthorized" ? "forbidden" : "unavailable" };
  }
  const d = (r.data ?? {}) as { confirmed?: number; failed?: number; unchanged?: number; failures?: { label?: unknown; message?: unknown }[] };
  const failures = Array.isArray(d.failures) ? d.failures.map((f) => ({ label: String(f.label ?? ""), message: String(f.message ?? "") })) : undefined;
  return { kind: "ok", confirmed: Number(d.confirmed ?? 0), failed: Number(d.failed ?? 0), unchanged: typeof d.unchanged === "number" ? d.unchanged : undefined, failures };
}

/** Garante a sessão com segundo fator: se ainda está em aal1, pede o código do autenticador já cadastrado. `false` = não confirmou. */
export async function ensureSecondFactor(ask: (msg: string) => string | null): Promise<"ok" | "cancelled" | "no-factor" | "wrong-code"> {
  const mfa = browserSupabase().auth.mfa;
  const lvl = await mfa.getAuthenticatorAssuranceLevel();
  if (lvl.data?.currentLevel === "aal2") return "ok";
  const factorId = (await mfa.listFactors()).data?.totp.find((f) => f.status === "verified")?.id;
  if (!factorId) return "no-factor";
  const code = ask("Código de 6 dígitos do aplicativo autenticador")?.replace(/\s/g, "");
  if (!code) return "cancelled";
  const v = await mfa.challengeAndVerify({ factorId, code });
  return v.error ? "wrong-code" : "ok";
}
