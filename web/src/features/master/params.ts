export type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Testes entram nos números só quando `?testes=1` (padrão: ocultos). */
export function includeTests(sp: SearchParams): boolean { return first(sp.testes) === "1"; }

export type Period = 7 | 30 | 90;
export const PERIODS: readonly Period[] = [7, 30, 90];
/** Período em dias: aceita `?dias=` (compatível com a página atual) ou `?periodo=`; padrão 30. */
export function periodDays(sp: SearchParams): Period {
  const n = Number(first(sp.dias) ?? first(sp.periodo));
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

/** Erro de PostgREST/Postgres que significa "a função não existe (ainda)". */
export function isMissingRpc(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}
