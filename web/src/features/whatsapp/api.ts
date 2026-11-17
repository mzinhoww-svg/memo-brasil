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

/** Link wa.me pronto (código de uso único) e até quando vale. */
export type WhatsappLink = { link: string; validUntil: number };
export const LINK_TTL_MS = 15 * 60_000;
const RENEW_MARGIN_MS = 90_000; // renova antes de vencer: o toque nunca pega um código vencido

/** Pede um código novo (uso único, 15 min) e devolve o link wa.me. Erros viram `WhatsappError` com mensagem amigável na tela. */
export async function requestWhatsappLink(eventId: string, now = Date.now()): Promise<WhatsappLink> {
  const r = await browserSupabase().functions.invoke("whatsapp-optin", { body: { eventId } });
  if (r.error) {
    const status = (r.error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new WhatsappError("muitas");
    if (status === 401 || status === 403) throw new WhatsappError("forbidden");
    if (status === 502 || status === 503 || status === 404) throw new WhatsappError("gateway");
    throw new WhatsappError("rede");
  }
  const d = (r.data ?? {}) as { waLink?: unknown; expiresAt?: unknown };
  if (typeof d.waLink !== "string" || !/^https:\/\/wa\.me\//.test(d.waLink)) throw new WhatsappError("gateway");
  const server = typeof d.expiresAt === "string" ? Date.parse(d.expiresAt) : NaN;
  const end = Number.isFinite(server) ? Math.min(server, now + LINK_TTL_MS) : now + LINK_TTL_MS;
  return { link: d.waLink, validUntil: end - RENEW_MARGIN_MS };
}

/** Mudanças da própria linha (Realtime): "Ativado ✓" assim que o webhook grava. Devolve a função que cancela. */
export function subscribeWhatsappStatus(eventId: string, onChange: () => void): () => void {
  if (backendMode() !== "supabase") return () => undefined;
  const sb = browserSupabase();
  const ch = sb.channel(`wa-optin:${eventId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "participant_whatsapp", filter: `event_id=eq.${eventId}` }, () => onChange())
    .subscribe();
  return () => { void sb.removeChannel(ch); };
}

export type ReturnExchange =
  | { status: "ok"; code?: string; title?: string; same?: boolean; tokenHash?: string }
  | { status: "used" | "expired" | "invalid" | "blocked"; code?: string; title?: string };

/** Link de volta do bot: troca o token de uso único (nunca registrado) por uma sessão do mesmo convidado. */
export async function exchangeReturnToken(token: string): Promise<ReturnExchange> {
  const r = await browserSupabase().functions.invoke("whatsapp-return", { body: { token } });
  if (r.error) throw new WhatsappError("rede");
  const d = (r.data ?? {}) as Record<string, unknown>;
  const st = ["ok", "used", "expired", "invalid", "blocked"].includes(String(d.status)) ? (d.status as ReturnExchange["status"]) : "invalid";
  const meta = { code: typeof d.code === "string" ? d.code : undefined, title: typeof d.title === "string" ? d.title : undefined };
  if (st === "ok") return { status: "ok", ...meta, same: d.same === true, tokenHash: typeof d.tokenHash === "string" ? d.tokenHash : undefined };
  return { status: st, ...meta };
}

/** Compatibilidade: só o link. */
export async function requestWhatsappOptin(eventId: string): Promise<string> {
  return (await requestWhatsappLink(eventId)).link;
}
