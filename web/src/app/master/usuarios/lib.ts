import type { SearchParams } from "@/features/master/params";

export type UserKind = "google" | "email" | "anon";
export interface UserItem {
  userId: string; isAnonymous: boolean; provider: string; email: string | null; createdAt: string; lastSignInAt: string | null;
  platformRole: string | null; eventsLinked?: number; isTest?: boolean; orphanAnon?: boolean;
}
export interface UserSummary { google: number; email: number; anon: number; orphanAnon: number | null }
export interface UsersPage { total: number; items: UserItem[]; summary: UserSummary }

export const PER_PAGE = 50;
export const LEGACY_LIMIT = 200;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseKind(sp: SearchParams): UserKind | null {
  const k = first(sp.tipo);
  return k === "google" || k === "email" || k === "anon" ? k : null;
}
export function parsePage(sp: SearchParams): number {
  const n = Math.floor(Number(first(sp.p)));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
export function parseQuery(sp: SearchParams): string {
  return (first(sp.q) ?? "").trim().slice(0, 80);
}

export function kindOf(u: Pick<UserItem, "isAnonymous" | "provider">): UserKind {
  if (u.isAnonymous) return "anon";
  return u.provider === "google" ? "google" : "email";
}

/** Resumo calculado dos itens (só para o modo degradado, onde a base inteira não está disponível). */
export function summarize(items: readonly UserItem[]): UserSummary {
  const s: UserSummary = { google: 0, email: 0, anon: 0, orphanAnon: null };
  for (const u of items) s[kindOf(u)]++;
  return s;
}

export function matchesQuery(u: UserItem, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return u.userId.toLowerCase() === t || (u.email ?? "").toLowerCase().includes(t);
}

/** Fallback de `admin_list_users`: filtros aplicados em memória sobre os últimos itens; sem eventsLinked/órfã/teste. */
export function fromLegacy(data: unknown, filter: { kind: UserKind | null; q: string }, page: number): UsersPage {
  const raw = (data as { items?: UserItem[] } | null)?.items ?? [];
  const items = raw.map((u) => ({ ...u, eventsLinked: undefined, isTest: undefined, orphanAnon: undefined }));
  const summary = summarize(items);
  const filtered = items.filter((u) => (!filter.kind || kindOf(u) === filter.kind) && matchesQuery(u, filter.q));
  const start = (page - 1) * PER_PAGE;
  return { total: filtered.length, items: filtered.slice(start, start + PER_PAGE), summary };
}

/** Anônima sem nenhuma participação: candidata à rotina de limpeza. */
export const isOrphan = (u: UserItem) => u.orphanAnon === true;

export function pageCount(total: number, perPage = PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage));
}
