/** Contrato da busca global (`GET /master/busca?q=`), compartilhado entre a rota e o `CommandSearch`. */
export interface SearchResults {
  events: { id: string; title: string }[];
  users: { userId: string; email: string }[];
  orders: { id: string; eventId: string | null; status: string }[];
  /** `admin_search` ainda não existe: só eventos (via `admin_list_events`). */
  degraded?: boolean;
}

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 80;
export const SEARCH_LIMIT = 5;
export const EMPTY_RESULTS: SearchResults = { events: [], users: [], orders: [] };

type Obj = Record<string, unknown>;
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === "object") : []);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Normaliza a saída de `admin_search` (máx. 5 por tipo; descarta itens sem id). */
export function normalizeSearch(data: unknown): SearchResults {
  const d = (data && typeof data === "object" ? data : {}) as Obj;
  return {
    events: list(d.events).map((e) => ({ id: str(e.id), title: str(e.title) || "Sem título" })).filter((e) => e.id).slice(0, SEARCH_LIMIT),
    users: list(d.users).map((u) => ({ userId: str(u.userId), email: str(u.email) })).filter((u) => u.userId).slice(0, SEARCH_LIMIT),
    orders: list(d.orders).map((o) => ({ id: str(o.id), eventId: o.eventId ? str(o.eventId) : null, status: str(o.status) })).filter((o) => o.id).slice(0, SEARCH_LIMIT),
  };
}

/** Fallback: itens de `admin_list_events` viram resultados de evento. */
export function eventsFromList(data: unknown): SearchResults["events"] {
  const d = (data && typeof data === "object" ? data : {}) as Obj;
  return list(d.items).map((e) => ({ id: str(e.id), title: str(e.title) || "Sem título" })).filter((e) => e.id).slice(0, SEARCH_LIMIT);
}

export const eventHref = (id: string) => `/master/eventos?ev=${encodeURIComponent(id)}`;
export const userHref = (id: string) => `/master/usuarios?q=${encodeURIComponent(id)}`;
export const orderHref = (id: string) => `/master/pagamentos?q=${encodeURIComponent(id)}`;
