import { pageNumber, PAGE_SIZE } from "./pagination";
import { nf } from "./format";

/** Somente listas com mais de uma página ocupam o slot de navegação. */
export function MasterPager({ total, page, path, query = {} }: { total: number; page: number; path: string; query?: Record<string, string | undefined> }) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (last === 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (p > 1) params.set("p", String(p));
    return `${path}${params.size ? `?${params}` : ""}`;
  };
  return <nav aria-label="Paginação" className="row" style={{ gap: "12px", marginTop: "16px", alignItems: "center" }}>
    {page > 1 && <a className="link" href={href(page - 1)}>← Anterior</a>}
    <span className="rv-caption">Página {pageNumber(String(page))} de {last} · {nf(total)} registros</span>
    {page < last && <a className="link" href={href(page + 1)}>Próxima →</a>}
  </nav>;
}
