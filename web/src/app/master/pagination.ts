export const PAGE_SIZE = 25;
export type ListSearch = { q?: string; p?: string; i?: string };
export type ListProps = { searchParams: Promise<ListSearch> };
export function pageNumber(value?: string): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1_000_000) : 1;
}
export function listArgs(sp: ListSearch, key: 'p' | 'i' = 'p') {
  return { p_limit: PAGE_SIZE, p_offset: (pageNumber(sp[key]) - 1) * PAGE_SIZE, p_search: sp.q?.trim().slice(0, 80) || null };
}
