import Link from "next/link";
import type { SearchParams } from "@/features/master/params";
import { hrefWith } from "../kit/url";

/** Paginação por links `?p=`; preserva os demais parâmetros. */
export function Pager({ path, params, page, pages, total, noun }: { path: string; params: SearchParams; page: number; pages: number; total: string; noun: string }) {
  return (
    <nav aria-label="Paginação" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, alignItems: "center" }}>
      {page > 1 && <Link className="adm-btn" href={hrefWith(path, params, { p: String(page - 1) })}>Anterior</Link>}
      <span className="adm-nota">Página {page} de {pages}, {total} {noun}</span>
      {page < pages && <Link className="adm-btn" href={hrefWith(path, params, { p: String(page + 1) })}>Próxima</Link>}
    </nav>
  );
}
