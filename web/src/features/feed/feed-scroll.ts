/**
 * Posição do Feed por evento: rolagem, quantas fotos já estavam carregadas (`limit`) e o autor filtrado.
 * A lista rola dentro de um contêiner, que o navegador não restaura sozinho; guardamos em memória e em
 * `sessionStorage` (protegido: sem ele o Feed só abre no topo).
 */
export interface FeedScrollState { top: number; limit: number; author: string }

const mem = new Map<string, FeedScrollState>();
export const feedScrollKey = (code: string) => `rv:feed:${code}`;

function valid(v: unknown): v is FeedScrollState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.top === "number" && Number.isFinite(s.top) && typeof s.limit === "number" && Number.isFinite(s.limit) && typeof s.author === "string";
}

export function saveFeedScroll(code: string, state: FeedScrollState): void {
  const s = { top: Math.max(0, Math.round(state.top)), limit: Math.max(1, Math.round(state.limit)), author: state.author };
  mem.set(code, s);
  try { window.sessionStorage.setItem(feedScrollKey(code), JSON.stringify(s)); } catch { /* sem armazenamento: só memória */ }
}

export function readFeedScroll(code: string): FeedScrollState | undefined {
  const cached = mem.get(code);
  if (cached) return cached;
  try {
    const raw = window.sessionStorage.getItem(feedScrollKey(code));
    if (raw) {
      const v: unknown = JSON.parse(raw);
      if (valid(v)) { mem.set(code, v); return v; }
    }
  } catch { /* ignora */ }
  return undefined;
}

export function clearFeedScroll(code: string): void {
  mem.delete(code);
  try { window.sessionStorage.removeItem(feedScrollKey(code)); } catch { /* ignora */ }
}
