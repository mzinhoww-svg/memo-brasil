import Link from "next/link";
import type { ReactNode } from "react";
import type { SearchParams } from "@/features/master/params";
import { EmptyState } from "./EmptyState";
import { hrefWith, type SortDir } from "./url";

export interface SortableCol<R> {
  key: string;
  label: string;
  num?: boolean;
  /** Padrão: true. Colunas não ordenáveis têm cabeçalho simples. */
  sortable?: boolean;
  render?: (row: R) => ReactNode;
}
export interface SortableTableProps<R> {
  cols: readonly SortableCol<R>[];
  rows: readonly R[];
  path: string;
  params: SearchParams;
  ord?: string;
  dir?: SortDir;
  empty: { title: string; text?: string; action?: { href: string; label: string } };
  rowKey?: (row: R, i: number) => string;
  caption?: string;
}

/** Tabela renderizada no servidor; o cabeçalho ordena por links `?ord=&dir=` (a ordenação em si é de quem chama). */
export function SortableTable<R extends object>({ cols, rows, path, params, ord, dir = "asc", empty, rowKey, caption }: SortableTableProps<R>) {
  if (!rows.length) return <EmptyState {...empty} />;
  return (
    <div className="adm-table-wrap adm-sortable" role="region" tabIndex={0} aria-label={caption ?? "Tabela rolável"}>
      <table className="adm-table">
        {caption && <caption className="adm-sr">{caption}</caption>}
        <thead>
          <tr>
            {cols.map((c) => {
              const ativa = ord === c.key;
              const proxima: SortDir = ativa && dir === "asc" ? "desc" : "asc";
              return (
                <th key={c.key} scope="col" className={`adm-th${c.num ? " num" : ""}`} aria-sort={ativa ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortable === false ? c.label : (
                    <Link href={hrefWith(path, params, { ord: c.key, dir: proxima })}>{c.label}{ativa && <span aria-hidden="true">{dir === "asc" ? " ↑" : " ↓"}</span>}</Link>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i}>
              {cols.map((c) => <td key={c.key} className={c.num ? "num" : undefined}>{c.render ? c.render(r) : (((r as Record<string, unknown>)[c.key] ?? "—") as ReactNode)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
