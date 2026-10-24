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

export type RpcError = { code?: string | null; message?: string | null; hint?: string | null } | null | undefined;
export type RpcErrorKind = "missing" | "mismatch" | "other";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Classifica o erro de uma chamada `rpc(name)`:
 * - `missing`: a função `name` não existe no banco (migration não aplicada): PGRST202/42883 cuja mensagem cita a própria
 *   função, sem dica do PostgREST apontando para uma assinatura dela.
 * - `mismatch`: a função existe com outra assinatura (a dica sugere `public.<name>(...)`): argumento errado ou digitado.
 * - `other`: qualquer outro erro (inclusive uma função auxiliar inexistente chamada por dentro).
 * Sem `name`, só olha o código (uso antigo).
 */
export function rpcErrorKind(error: RpcError, name?: string): RpcErrorKind {
  if (!error) return "other";
  const msg = error.message ?? "";
  const fnErr = error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(msg);
  if (!fnErr) return "other";
  if (!name) return "missing";
  const n = esc(name);
  if (!new RegExp(`(^|[\\s."])${n}(\\(|\\b)`).test(msg)) return "other";
  if (error.hint && new RegExp(`public\\.${n}\\(`).test(error.hint)) return "mismatch";
  return "missing";
}

/** Erro de PostgREST/Postgres que significa "a função não existe (ainda)". */
export function isMissingRpc(error: RpcError, name?: string): boolean {
  return rpcErrorKind(error, name) === "missing";
}
