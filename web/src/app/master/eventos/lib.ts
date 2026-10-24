/** Transformações puras da página Eventos (lista, drawer, lote). Sem dependência de servidor. */
import type { SearchParams } from "@/features/master/params";
import type { CatalogPlan } from "@/features/master/plan";

/** Capacidades vendidas no catálogo; fora disso o limite é manual (sinal de risco "fora do catálogo"). */
export const CATALOG_CAPACITIES: readonly number[] = [10, 30, 100, 250, 500];
export const PAGE_SIZE = 25;
export const BULK_MAX = 500;

/**
 * Corrige nomes duplicados por concatenação ("Aurimar NogueiraAurimar" vira "Aurimar Nogueira";
 * "Ana SilvaAna Silva" e "Ana Silva Ana Silva" viram "Ana Silva"). Nome sem duplicação volta como está (aparado).
 */
export function cleanHostName(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (s.length < 4) return s;
  // Concatenação sem espaço: minúscula seguida de maiúscula, e o resto repete o começo do nome em limite de palavra.
  for (let i = Math.ceil(s.length / 2); i < s.length - 1; i++) {
    const a = s.slice(0, i), rest = s.slice(i);
    if (!/\p{Ll}/u.test(s[i - 1]) || !/\p{Lu}/u.test(s[i])) continue;
    if (a.startsWith(rest) && (a.length === rest.length || a[rest.length] === " ")) return a;
  }
  // Repetição exata separada por espaço, com pelo menos duas palavras ("Ana Silva Ana Silva").
  const w = s.split(" ");
  if (w.length >= 4 && w.length % 2 === 0) {
    const h = w.length / 2;
    if (w.slice(0, h).join(" ") === w.slice(h).join(" ")) return w.slice(0, h).join(" ");
  }
  return s;
}

export type EventStatus = "ativo" | "encerrado" | "excluido";
export type RevealState = "desativada" | "revelada" | "atrasada" | "pendente";
export interface EventRow {
  id: string;
  title: string;
  hostName: string;
  hostId: string | null;
  status: EventStatus | string;
  startAt: string | null;
  createdAt: string | null;
  revealState: RevealState | string;
  revealAt: string | null;
  participants: number;
  photos: number;
  failedUploads: number;
  capacity: number | null;
  shotsPerPerson: number | null;
  planCode: string | null;
  /** null = desconhecido (RPC antiga não informa). */
  isTest: boolean | null;
  deletedAt: string | null;
}
export interface EventPage { total: number; items: EventRow[] }

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const s = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Normaliza um item de admin_list_events_v2 ou admin_list_events (antiga) para `EventRow`. */
export function toEventRow(raw: Record<string, unknown>): EventRow {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    hostName: cleanHostName(raw.hostName as string),
    hostId: s(raw.hostId),
    status: String(raw.status ?? ""),
    startAt: s(raw.startAt),
    createdAt: s(raw.createdAt),
    revealState: String(raw.revealState ?? ""),
    revealAt: s(raw.revealAt),
    participants: n(raw.participants),
    photos: n(raw.photos),
    failedUploads: n(raw.failedUploads),
    capacity: raw.capacity == null ? null : n(raw.capacity),
    shotsPerPerson: raw.shotsPerPerson == null ? null : n(raw.shotsPerPerson),
    planCode: s(raw.planCode),
    isTest: typeof raw.isTest === "boolean" ? raw.isTest : null,
    deletedAt: s(raw.deletedAt),
  };
}
export function toEventPage(data: unknown): EventPage {
  const d = (data ?? {}) as { total?: unknown; items?: unknown };
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]).map(toEventRow) : [];
  return { total: n(d.total), items };
}

/** Colunas ordenáveis da tabela = valores aceitos por `p_sort` da RPC nova. */
export const SORT_KEYS = ["title", "hostName", "status", "participants", "photos", "revealAt", "startAt", "createdAt"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Filtro de situação: `ativo|encerrado|excluido`; `excluido` só existe na RPC nova. */
export function statusParam(sp: SearchParams): EventStatus | null {
  const v = first(sp.status);
  return v === "ativo" || v === "encerrado" || v === "excluido" ? v : null;
}
export function pageParam(sp: SearchParams): number {
  return Math.max(1, Math.floor(Number(first(sp.p)) || 1));
}
export function searchParam(sp: SearchParams): string | null {
  const v = first(sp.q)?.trim().slice(0, 80);
  return v ? v : null;
}
export function eventParam(sp: SearchParams): string | null {
  const v = first(sp.ev);
  return v && UUID.test(v) ? v : null;
}

/** Só eventos marcados como teste podem ser excluídos em lote. */
export function deletableIds(rows: readonly Pick<EventRow, "id" | "isTest" | "deletedAt">[]): string[] {
  return rows.filter((r) => r.isTest === true && !r.deletedAt).map((r) => r.id);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lista de ids vinda do formulário (separada por vírgula): única, válida e com até `BULK_MAX`; senão null. */
export function parseIds(raw: unknown): string[] | null {
  if (typeof raw !== "string") return null;
  const ids = [...new Set(raw.split(",").map((x) => x.trim()).filter(Boolean))];
  if (!ids.length || ids.length > BULK_MAX || !ids.every((x) => UUID.test(x))) return null;
  return ids;
}

export interface EventDetail {
  event: EventRow & { endAt?: string | null; revealedAt?: string | null; category?: string | null };
  entitlement: { planCode: string | null; maxGuests: number | null; maxShots: number | null; source: string | null } | null;
  timeline: { at: string; kind: string; label: string }[];
  participants: { name: string; joinedAt: string | null; isHost: boolean }[];
  orders: { id: string; status: string; amountCents: number; createdAt: string | null }[];
  audit: { at: string; action: string; actorRole: string | null; reason: string | null }[];
}
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export function toEventDetail(data: unknown): EventDetail | null {
  const d = (data ?? {}) as Record<string, unknown>;
  if (!d.event || typeof d.event !== "object") return null;
  const ev = d.event as Record<string, unknown>;
  const ent = d.entitlement as Record<string, unknown> | null | undefined;
  return {
    event: { ...toEventRow(ev), endAt: s(ev.endAt), revealedAt: s(ev.revealedAt), category: s(ev.category) },
    entitlement: ent ? { planCode: s(ent.planCode), maxGuests: ent.maxGuests == null ? null : n(ent.maxGuests), maxShots: ent.maxShots == null ? null : n(ent.maxShots), source: s(ent.source) } : null,
    timeline: arr<{ at: string; kind: string; label: string }>(d.timeline).slice().sort((a, b) => String(a.at).localeCompare(String(b.at))),
    participants: arr<{ name: string; joinedAt: string | null; isHost: boolean }>(d.participants).map((p) => ({ ...p, name: cleanHostName(p.name) })),
    orders: arr(d.orders),
    audit: arr(d.audit),
  };
}
/** Sem `admin_event_detail`: monta o mínimo a partir da lista antiga (sem linha do tempo, participantes nem auditoria). */
export function detailFromList(data: unknown, id: string): EventDetail | null {
  const row = toEventPage(data).items.find((e) => e.id === id);
  if (!row) return null;
  return { event: row, entitlement: null, timeline: [], participants: [], orders: [], audit: [] };
}

const ROLE: Record<string, string> = { master: "master", support: "suporte", auditor: "auditor", organizador: "organizador", convidado: "convidado", operador: "operador", sistema: "sistema" };
export const roleLabel = (r: string | null | undefined) => (r ? ROLE[r] ?? r : "—");

/** Catálogo para `planLabel` a partir de `admin_list_plans` (planos sem limite de convidados casam só pelo código). */
export function toCatalog(data: unknown): CatalogPlan[] {
  if (!Array.isArray(data)) return [];
  return (data as { code?: string; name?: string; maxGuests?: number | null; priceCents?: number }[])
    .filter((p) => p.code && p.name)
    .map((p) => ({ code: String(p.code), name: String(p.name), capacity: p.maxGuests == null ? -1 : Number(p.maxGuests), priceCents: Number(p.priceCents) || 0 }));
}

/** Data e hora curtas no fuso do produto (servidor e navegador produzem o mesmo texto). */
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Cuiaba", dateStyle: "short", timeStyle: "short" }) : "—");

export const STATUS_TONE: Record<string, "ok" | "dim" | "crit"> = { ativo: "ok", encerrado: "dim", excluido: "crit" };
export const REVEAL_TONE: Record<string, "ok" | "warn" | "crit" | "dim"> = { revelada: "ok", pendente: "warn", atrasada: "crit", desativada: "dim" };

export type ActionResult = { ok: true; count: number } | { ok: false; error: string };

/** Texto da recusa (MM005) de `admin_soft_delete_test_events`; null para outros códigos (texto padrão de erro). */
export function softDeleteRefusal(error: { code?: string | null; message?: string | null }): string | null {
  if (error.code !== "MM005") return null;
  if (/\bpaid\b/.test(error.message ?? "")) return "O lote tem evento com pagamento confirmado ou plano pago/cortesia ativo. Nada foi excluído.";
  return "O lote tem evento que não é de teste ou que não existe. Nada foi excluído.";
}
/** Valida a entrada de uma ação em lote (ids + motivo obrigatório); o servidor confere de novo (MM005/MM011). */
export function bulkInput(ids: unknown, reason: unknown, reasonError: (r: string) => string | null): { ids: string[]; reason: string } | { error: string } {
  const list = parseIds(ids);
  if (!list) return { error: "Selecione de 1 a 500 eventos." };
  const r = typeof reason === "string" ? reason.trim() : "";
  const e = reasonError(r);
  return e ? { error: e } : { ids: list, reason: r };
}
