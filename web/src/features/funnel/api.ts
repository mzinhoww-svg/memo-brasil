/**
 * Funil de quiz (cliente). O lead não tem dado pessoal: o navegador guarda só o id (uuid) para a oferta acompanhar a pessoa do quiz
 * até a criação do evento. O prazo da oferta é do servidor (`funnel_lead_view` devolve o relógio dele); aqui só se mostra.
 * Fora da nuvem (modo local de desenvolvimento e testes) o lead é simulado no próprio navegador, com os mesmos 30 minutos.
 */
import { readFirstTouch, LAST_TOUCH_KEY } from "@/lib/access/first-touch";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

export const LEAD_KEY = "mm-funil-lead";
const LOCAL_KEY = "mm-funil-local";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const OFFER_MINUTES = 30;
/** Termos da oferta no modo local e antes de o servidor responder (espelham o plano `ate50` da migration do funil). */
export const OFFER_FALLBACK = { planCode: "ate50", priceCents: 1990, maxGuests: 50, maxShots: 36 } as const;

export type LeadCreated = { leadId: string; expiresAt: string; waLink: string | null };
export type LeadView = {
  quiz: string; profile: string | null; guests: number | null;
  /** Instante (do servidor) em que a oferta vence. */
  expiresAtMs: number;
  /** Relógio do servidor menos o do aparelho, para a contagem não depender do relógio do celular. */
  clockOffsetMs: number;
  active: boolean; planCode: string; priceCents: number; maxGuests: number; maxShots: number | null;
  claimed: boolean; eventId: string | null; paid: boolean;
};
export class FunnelError extends Error {
  constructor(readonly kind: "muitas" | "rede") { super(kind); this.name = "FunnelError"; }
}

export const isLeadId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export function rememberLead(id: string): void {
  try { if (isLeadId(id)) localStorage.setItem(LEAD_KEY, id); } catch { /* sem armazenamento: a oferta segue pelo link */ }
}
export function readLead(): string | null {
  try { const v = localStorage.getItem(LEAD_KEY); return isLeadId(v) ? v : null; } catch { return null; }
}
export function forgetLead(): void {
  try { localStorage.removeItem(LEAD_KEY); } catch { /* nada a limpar */ }
}

type LocalLead = { id: string; quiz: string; profile: string | null; guests: number | null; expiresAt: number };
function localLead(): LocalLead | null {
  try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null") as LocalLead | null; return v && isLeadId(v.id) ? v : null; } catch { return null; }
}

/** Cria o lead ao fim do quiz. `whatsapp: false` (entrada direta pelo link da oferta) não pede o link do WhatsApp. */
export async function createLead(i: { quiz: string; profile: string | null; guests: number | null; whatsapp: boolean }, now = Date.now()): Promise<LeadCreated> {
  if (backendMode() !== "supabase") {
    const lead: LocalLead = { id: crypto.randomUUID(), quiz: i.quiz, profile: i.profile, guests: i.guests, expiresAt: now + OFFER_MINUTES * 60_000 };
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(lead)); } catch { /* segue só em memória */ }
    rememberLead(lead.id);
    return { leadId: lead.id, expiresAt: new Date(lead.expiresAt).toISOString(), waLink: null };
  }
  const origin = readFirstTouch(LAST_TOUCH_KEY) ?? readFirstTouch();
  const r = await browserSupabase().functions.invoke("funnel-lead", {
    body: { quiz: i.quiz, profile: i.profile, guests: i.guests, whatsapp: i.whatsapp, source: origin?.source ?? null, medium: origin?.medium ?? null, campaign: origin?.campaign ?? null },
  });
  if (r.error) throw new FunnelError((r.error as { context?: { status?: number } }).context?.status === 429 ? "muitas" : "rede");
  const d = r.data as { leadId?: unknown; expiresAt?: unknown; waLink?: unknown } | null;
  if (!isLeadId(d?.leadId) || typeof d?.expiresAt !== "string") throw new FunnelError("rede");
  rememberLead(d.leadId);
  const waLink = typeof d.waLink === "string" && /^https:\/\/wa\.me\//.test(d.waLink) ? d.waLink : null;
  return { leadId: d.leadId, expiresAt: d.expiresAt, waLink };
}

/** Estado da oferta do lead; null = lead desconhecido. */
export async function viewLead(leadId: string, now = Date.now()): Promise<LeadView | null> {
  if (!isLeadId(leadId)) return null;
  if (backendMode() !== "supabase") {
    const l = localLead();
    if (!l || l.id !== leadId) return null;
    return { quiz: l.quiz, profile: l.profile, guests: l.guests, expiresAtMs: l.expiresAt, clockOffsetMs: 0, active: l.expiresAt > now, ...OFFER_FALLBACK, claimed: false, eventId: null, paid: false };
  }
  const { data, error } = await browserSupabase().rpc("funnel_lead_view", { p_lead: leadId });
  if (error) throw new FunnelError("rede");
  const d = data as Record<string, unknown> | null;
  const expires = typeof d?.expiresAt === "string" ? Date.parse(d.expiresAt) : NaN;
  const server = typeof d?.now === "string" ? Date.parse(d.now) : NaN;
  if (!d || typeof d.quiz !== "string" || !Number.isFinite(expires) || typeof d.planCode !== "string" || typeof d.priceCents !== "number" || typeof d.maxGuests !== "number") return null;
  return {
    quiz: d.quiz, profile: typeof d.profile === "string" ? d.profile : null, guests: typeof d.guests === "number" ? d.guests : null,
    expiresAtMs: expires, clockOffsetMs: Number.isFinite(server) ? server - now : 0,
    active: d.active === true, planCode: d.planCode, priceCents: d.priceCents, maxGuests: d.maxGuests, maxShots: typeof d.maxShots === "number" ? d.maxShots : null,
    claimed: d.claimed === true, eventId: typeof d.eventId === "string" ? d.eventId : null, paid: d.paid === true,
  };
}

/**
 * Liga o lead guardado neste navegador ao evento recém-criado. Devolve o plano da oferta quando ela ainda vale; null em qualquer
 * outro caso (sem lead, vencida, já usada, fora da nuvem ou falha). Nunca lança: não pode atrapalhar a criação do evento.
 */
export async function claimFunnelOffer(eventId: string): Promise<{ planCode: string; expiresAt: string } | null> {
  try {
    const leadId = readLead();
    if (!leadId || backendMode() !== "supabase") return null;
    const { data, error } = await browserSupabase().rpc("funnel_offer_claim", { p_lead: leadId, p_event: eventId });
    const d = data as { planCode?: unknown; expiresAt?: unknown } | null;
    if (error || typeof d?.planCode !== "string" || typeof d.expiresAt !== "string") { if (!error) forgetLead(); return null; }
    return { planCode: d.planCode, expiresAt: d.expiresAt };
  } catch {
    return null;
  }
}

export type EventFunnelOffer = { planCode: string; priceCents: number; maxGuests: number; expiresAtMs: number; clockOffsetMs: number };
/** Oferta do funil ainda válida para o evento (painel do anfitrião); null sem oferta. */
export async function eventFunnelOffer(eventId: string, now = Date.now()): Promise<EventFunnelOffer | null> {
  if (backendMode() !== "supabase") return null;
  const { data, error } = await browserSupabase().rpc("event_funnel_offer", { p_event: eventId });
  const d = data as Record<string, unknown> | null;
  const expires = typeof d?.expiresAt === "string" ? Date.parse(d.expiresAt) : NaN;
  const server = typeof d?.now === "string" ? Date.parse(d.now) : NaN;
  if (error || !d || typeof d.planCode !== "string" || typeof d.priceCents !== "number" || typeof d.maxGuests !== "number" || !Number.isFinite(expires)) return null;
  return { planCode: d.planCode, priceCents: d.priceCents, maxGuests: d.maxGuests, expiresAtMs: expires, clockOffsetMs: Number.isFinite(server) ? server - now : 0 };
}

/** mm:ss que restam (nunca negativo). */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const brl = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
