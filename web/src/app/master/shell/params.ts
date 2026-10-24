import type { SearchParams } from "@/features/master/params";

/** Parâmetros globais do console que acompanham a navegação entre módulos. */
export const SHELL_PARAMS = ["testes", "dias"] as const;

type ParamsLike = SearchParams | URLSearchParams | { get(name: string): string | null } | null | undefined;

function read(sp: ParamsLike, key: string): string | undefined {
  if (!sp) return undefined;
  if (typeof (sp as URLSearchParams).get === "function") return (sp as URLSearchParams).get(key) ?? undefined;
  const v = (sp as SearchParams)[key];
  return (Array.isArray(v) ? v[0] : v) ?? undefined;
}

/**
 * Leva `testes` e `dias` da URL atual para `href` (o toggle "Ocultar testes" e o período persistem entre páginas).
 * Parâmetros que o próprio `href` já traz prevalecem. Aceita `searchParams` de página ou `useSearchParams()`.
 */
export function withShellParams(href: string, searchParams: ParamsLike): string {
  const [pathAndQuery, hash = ""] = href.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const u = new URLSearchParams(query);
  for (const k of SHELL_PARAMS) {
    const v = read(searchParams, k);
    if (v && !u.has(k)) u.set(k, v);
  }
  const q = u.toString();
  return `${path}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
}
