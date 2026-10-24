export interface Part { eventId?: string; eventTitle: string; userId?: string; name: string; table: string | null; joinedAt: string; blocked: boolean; isHost: boolean }
export interface Invite { id?: string; eventId?: string; eventTitle: string; label: string; uses: number; maxUses: number | null; state: string; expiresAt: string | null; createdAt?: string }
export interface Group { key: string; title: string; count: number; blocked: number; items: Part[] }

/** Remove linhas de eventos de teste. `testIds` nulo = sem informação (modo degradado): nada é removido. */
export function excludeTestEvents<T extends { eventId?: string }>(items: readonly T[], testIds: ReadonlySet<string> | null): T[] {
  if (!testIds) return [...items];
  return items.filter((i) => !(i.eventId && testIds.has(i.eventId)));
}

/** Agrupa por evento (id, senão título). Maiores grupos primeiro; empate por título. */
export function groupByEvent(items: readonly Part[]): Group[] {
  const m = new Map<string, Group>();
  for (const p of items) {
    const key = p.eventId ?? `t:${p.eventTitle}`;
    const g = m.get(key) ?? { key, title: p.eventTitle, count: 0, blocked: 0, items: [] };
    g.count++; if (p.blocked) g.blocked++; g.items.push(p);
    m.set(key, g);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "pt-BR") || a.key.localeCompare(b.key));
}

const empty = (v: unknown) => v == null || (typeof v === "string" && (v.trim() === "" || v.trim() === "—"));
/** Chaves de coluna com pelo menos um valor preenchido (colunas 100% vazias somem). `always` força a coluna. */
export function visibleColumns<R extends object>(rows: readonly R[], keys: readonly (keyof R & string)[], always: readonly string[] = []): string[] {
  return keys.filter((k) => always.includes(k) || rows.some((r) => !empty((r as Record<string, unknown>)[k])));
}

export interface InviteStats { total: number; used: number; entries: number; rate: number | null; active: number }
/** Convite para entrada: parcela dos convites com pelo menos um uso; `entries` = soma dos usos. Sem convites, rate nulo. */
export function inviteStats(invites: readonly Invite[]): InviteStats {
  const total = invites.length;
  const used = invites.filter((i) => i.uses > 0).length;
  return { total, used, entries: invites.reduce((s, i) => s + (i.uses || 0), 0), rate: total ? used / total : null, active: invites.filter((i) => i.state === "ativo").length };
}
