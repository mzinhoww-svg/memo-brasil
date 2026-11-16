/**
 * Aviso por WhatsApp (cliente). O front NUNCA fala com o gateway nem vê chave: pede o link à Edge Function `whatsapp-optin`
 * (que devolve só o `waLink`) e lê o próprio estado pela RPC `whatsapp_status` (RLS: só a própria linha).
 */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

export type WhatsappStatus = { enabled: boolean; eligible: boolean; optin: boolean; optinAt: string | null; revoked: boolean };
export type WhatsappErrorKind = "gateway" | "muitas" | "forbidden" | "rede";

export class WhatsappError extends Error {
  constructor(readonly kind: WhatsappErrorKind) {
    super(kind);
    this.name = "WhatsappError";
  }
}

/** Estado do próprio convidado. `null` fora do modo nuvem ou se a leitura falhar (a tela some em vez de quebrar). */
export async function getWhatsappStatus(eventId: string): Promise<WhatsappStatus | null> {
  if (backendMode() !== "supabase") return null;
  const { data, error } = await browserSupabase().rpc("whatsapp_status", { p_event: eventId });
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return { enabled: d.enabled === true, eligible: d.eligible === true, optin: d.optin === true, optinAt: typeof d.optinAt === "string" ? d.optinAt : null, revoked: d.revoked === true };
}

/** Pede um código novo (uso único, 15 min) e devolve o link wa.me. Erros viram `WhatsappError` com mensagem amigável na tela. */
export async function requestWhatsappOptin(eventId: string): Promise<string> {
  const r = await browserSupabase().functions.invoke("whatsapp-optin", { body: { eventId } });
  if (r.error) {
    const status = (r.error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new WhatsappError("muitas");
    if (status === 401 || status === 403) throw new WhatsappError("forbidden");
    if (status === 502 || status === 503 || status === 404) throw new WhatsappError("gateway");
    throw new WhatsappError("rede");
  }
  const link = (r.data as { waLink?: unknown } | null)?.waLink;
  if (typeof link !== "string" || !/^https:\/\/wa\.me\//.test(link)) throw new WhatsappError("gateway");
  return link;
}
