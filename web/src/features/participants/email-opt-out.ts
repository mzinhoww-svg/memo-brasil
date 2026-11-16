import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { EMAIL_RE } from "./guest-email";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** O token do link do e-mail é um UUID (supabase/functions/_shared/reveal-email.ts: `/email/sair?t=<token>`). */
export const isOptOutToken = (t: string | null | undefined): t is string => typeof t === "string" && UUID.test(t);

export interface OptOutPreview { title: string; code: string; email: string | null; optedOut: boolean }
export type OptOutOutcome =
  | { state: "ok"; title: string; code: string; /** e-mail que acabou de sair da lista (a saída o apaga no servidor) */ email: string | null }
  | { state: "invalid" }
  | { state: "unavailable" };

async function rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
  return browserSupabase().rpc(fn, args) as unknown as Promise<{ data: unknown; error: unknown }>;
}

/**
 * 24j: o link do e-mail leva o token. Lê o evento e o e-mail (que a saída apaga) e já tira a pessoa da lista.
 * Sem servidor (modo local) ou sem token válido não há o que sair: "invalid".
 */
export async function leaveByToken(token: string | null | undefined): Promise<OptOutOutcome> {
  if (!isOptOutToken(token) || backendMode() !== "supabase") return { state: "invalid" };
  try {
    const p = await rpc("email_opt_out_preview", { p_token: token });
    if (p.error) return { state: "unavailable" };
    const info = p.data as OptOutPreview | null;
    if (!info) return { state: "invalid" };
    const out = await rpc("email_opt_out", { p_token: token });
    if (out.error) return { state: "unavailable" };
    return { state: "ok", title: info.title, code: info.code, email: info.email };
  } catch {
    return { state: "unavailable" };
  }
}

/** "Voltar a receber": reativa com o e-mail que a página guardou antes da saída. */
export async function resubscribeByToken(token: string, email: string): Promise<boolean> {
  if (!isOptOutToken(token) || !EMAIL_RE.test(email) || backendMode() !== "supabase") return false;
  try {
    const r = await rpc("email_resubscribe", { p_token: token, p_email: email });
    return !r.error && r.data === true;
  } catch {
    return false;
  }
}
