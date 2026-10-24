export interface EventLite {
  id: string; hostId: string | null; hostName?: string | null; participants: number; photos: number;
  revealState?: string; planCode?: string | null; isTest?: boolean; status?: string; deletedAt?: string | null;
}
export interface OrderLite { eventId: string | null; status: string; amountCents: number }
export interface Funnel4 { created: number; withParticipant: number; withPhoto: number; revealed: number }
export interface OrgAgg {
  hostId: string; name: string; events: number; participants: number; photos: number;
  topPlan: string | null; revenueCents: number | null; funnel: Funnel4;
}
export interface OrgListItem {
  userId: string; displayName: string | null; email: string | null; eventsCount: number; activeEvents: number;
  lastEventAt: string | null; photos: number; deletionRequested: boolean;
}
export interface OrgRow extends OrgAgg { email: string | null; lastEventAt: string | null; deletionRequested: boolean }

/** Plano mais usado (empate: ordem alfabética, para ser determinístico). */
export function topPlan(codes: readonly (string | null | undefined)[]): string | null {
  const m = new Map<string, number>();
  for (const c of codes) if (c) m.set(c, (m.get(c) ?? 0) + 1);
  let best: string | null = null; let n = 0;
  for (const [c, k] of [...m].sort((a, b) => a[0].localeCompare(b[0]))) if (k > n) { best = c; n = k; }
  return best;
}

/**
 * Agrega eventos por anfitrião. Ignora apagados e, sem `includeTests`, os marcados como teste.
 * `orders` nulo (não-master) deixa a receita nula; só pedidos `pago` contam.
 */
export function aggregateByHost(events: readonly EventLite[], orders: readonly OrderLite[] | null, opts: { includeTests: boolean }): OrgAgg[] {
  const byHost = new Map<string, EventLite[]>();
  for (const e of events) {
    if (!e.hostId || e.deletedAt || e.status === "excluido") continue;
    if (e.isTest && !opts.includeTests) continue;
    const list = byHost.get(e.hostId) ?? [];
    list.push(e);
    byHost.set(e.hostId, list);
  }
  const paidByEvent = new Map<string, number>();
  for (const o of orders ?? []) if (o.eventId && o.status === "pago") paidByEvent.set(o.eventId, (paidByEvent.get(o.eventId) ?? 0) + (o.amountCents || 0));
  const out: OrgAgg[] = [];
  for (const [hostId, evs] of byHost) {
    out.push({
      hostId,
      name: evs.map((e) => e.hostName).find((n) => n && n.trim()) ?? "",
      events: evs.length,
      participants: evs.reduce((s, e) => s + (e.participants || 0), 0),
      photos: evs.reduce((s, e) => s + (e.photos || 0), 0),
      topPlan: topPlan(evs.map((e) => e.planCode)),
      revenueCents: orders === null ? null : evs.reduce((s, e) => s + (paidByEvent.get(e.id) ?? 0), 0),
      funnel: {
        created: evs.length,
        withParticipant: evs.filter((e) => e.participants > 0).length,
        withPhoto: evs.filter((e) => e.photos > 0).length,
        revealed: evs.filter((e) => e.revealState === "revelada").length,
      },
    });
  }
  return out.sort((a, b) => b.events - a.events || a.name.localeCompare(b.name, "pt-BR") || a.hostId.localeCompare(b.hostId));
}

/**
 * Junta a lista de organizadores (e-mail, LGPD, último evento) com a agregação.
 * Com dados de eventos e `hideEmpty`, organizador sem evento visível some.
 * Sem dados de eventos (`aggs` nulo) mantém os números da própria lista.
 */
export function mergeOrganizers(list: readonly OrgListItem[], aggs: readonly OrgAgg[] | null, opts: { hideEmpty: boolean }): OrgRow[] {
  const m = new Map((aggs ?? []).map((a) => [a.hostId, a]));
  const rows: OrgRow[] = [];
  for (const o of list) {
    const a = m.get(o.userId);
    if (aggs && !a && opts.hideEmpty) continue;
    rows.push({
      hostId: o.userId,
      name: o.displayName?.trim() || a?.name || "",
      email: o.email, lastEventAt: o.lastEventAt, deletionRequested: o.deletionRequested,
      events: a?.events ?? o.eventsCount, participants: a?.participants ?? 0, photos: a?.photos ?? o.photos,
      topPlan: a?.topPlan ?? null, revenueCents: a?.revenueCents ?? null,
      funnel: a?.funnel ?? { created: o.eventsCount, withParticipant: 0, withPhoto: 0, revealed: 0 },
    });
  }
  return rows.sort((a, b) => b.events - a.events || a.name.localeCompare(b.name, "pt-BR") || a.hostId.localeCompare(b.hostId));
}

/** Percorre páginas de uma RPC com `total/items` até `cap` itens. Para no primeiro erro, devolvendo o que já veio. */
export async function collectPages<T>(
  fetchPage: (offset: number) => Promise<{ ok: true; total: number; items: T[] } | { ok: false }>,
  pageSize: number, cap: number,
): Promise<{ items: T[]; total: number; truncated: boolean; failed: boolean }> {
  const items: T[] = []; let total = 0;
  for (let off = 0; off < cap; off += pageSize) {
    const r = await fetchPage(off);
    if (!r.ok) return { items, total, truncated: items.length < total, failed: items.length === 0 };
    total = r.total; items.push(...r.items);
    if (r.items.length < pageSize || items.length >= total) break;
  }
  return { items, total, truncated: items.length < total, failed: false };
}
