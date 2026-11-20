/**
 * Avisos ao anfitrião por WhatsApp (cliente). O front nunca fala com o gateway: pede o link à Edge Function `whatsapp-optin`
 * (scope "host", devolve só o `waLink`) e lê o próprio estado pela RPC `host_whatsapp_status` (sem o telefone).
 */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

export type HostWhatsappStatus = { enabled: boolean; optin: boolean };
export type HostWhatsappErrorKind = "gateway" | "muitas" | "rede";
export class HostWhatsappError extends Error {
  constructor(readonly kind: HostWhatsappErrorKind) { super(kind); this.name = "HostWhatsappError"; }
}

/** `null` fora da nuvem ou se a leitura falhar (o cartão some em vez de quebrar). */
export async function getHostWhatsappStatus(): Promise<HostWhatsappStatus | null> {
  if (backendMode() !== "supabase") return null;
  const { data, error } = await browserSupabase().rpc("host_whatsapp_status");
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return { enabled: d.enabled === true, optin: d.optin === true };
}

/** Código de opt-in de uso único: a pessoa toca, o WhatsApp abre com a mensagem pronta e ela envia. */
export async function requestHostWhatsappLink(): Promise<string> {
  const r = await browserSupabase().functions.invoke("whatsapp-optin", { body: { scope: "host" } });
  if (r.error) {
    const status = (r.error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new HostWhatsappError("muitas");
    if (status === 502 || status === 503) throw new HostWhatsappError("gateway");
    throw new HostWhatsappError("rede");
  }
  const link = (r.data as { waLink?: unknown } | null)?.waLink;
  if (typeof link !== "string" || !/^https:\/\/wa\.me\//.test(link)) throw new HostWhatsappError("gateway");
  return link;
}

/** Realtime da própria linha: "ativado" assim que o webhook grava. Devolve a função que cancela. */
export function subscribeHostWhatsapp(onChange: () => void): () => void {
  if (backendMode() !== "supabase") return () => undefined;
  const sb = browserSupabase();
  const ch = sb.channel("host-wa").on("postgres_changes", { event: "*", schema: "public", table: "host_whatsapp" }, () => onChange()).subscribe();
  return () => { void sb.removeChannel(ch); };
}
