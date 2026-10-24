/** Chamadas às RPCs do console com fallback para a RPC antiga (sem `server-only`, para teste de unidade). */
import { rpcErrorKind, type RpcError } from "./params";

export type Load<T> = { state: "ok"; data: T; degraded?: boolean } | { state: "denied" } | { state: "error"; message: string };
type RpcFailure = NonNullable<RpcError> & { message: string };
export interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcFailure | null }>;
}
export interface Fallback<T> { name: string; args?: Record<string, unknown>; map?: (data: unknown) => T }

const forbidden = (e: RpcFailure) => e.code === "MM004" || /forbidden/i.test(e.message);

/** Chama uma RPC administrativa; a autorização final é do banco (`is_platform_staff()`), aqui só se traduz o erro. */
export async function callRpc<T>(sb: RpcClient, name: string, args?: Record<string, unknown>): Promise<Load<T>> {
  const { data, error } = await sb.rpc(name, args ?? {});
  if (!error) return { state: "ok", data: data as T };
  if (forbidden(error)) return { state: "denied" };
  return { state: "error", message: error.message };
}

/**
 * Chama a RPC nova; só quando ela não existe no banco (migration não aplicada) chama a antiga e devolve `degraded: true`
 * (a página avisa "Dados completos após a atualização do banco"), com `console.warn` citando a RPC.
 * Assinatura que não bate (argumento digitado errado): erro em desenvolvimento, para aparecer; em produção, degradado
 * com o mesmo aviso (banco com uma versão anterior da função).
 */
export async function callRpcOr<T>(sb: RpcClient, name: string, args: Record<string, unknown>, fallback: Fallback<T>): Promise<Load<T>> {
  const first = await sb.rpc(name, args);
  if (!first.error) return { state: "ok", data: first.data as T };
  const kind = rpcErrorKind(first.error, name);
  if (kind === "other") return forbidden(first.error) ? { state: "denied" } : { state: "error", message: first.error.message };
  if (kind === "mismatch" && process.env.NODE_ENV !== "production") {
    return { state: "error", message: `RPC ${name}: argumentos não batem com a assinatura no banco (${first.error.message})` };
  }
  console.warn(`[master] RPC ${name} ${kind === "missing" ? "inexistente" : "com assinatura diferente"} no banco; usando ${fallback.name} (modo degradado)`);
  const old = await callRpc<unknown>(sb, fallback.name, fallback.args ?? {});
  if (old.state !== "ok") return old;
  return { state: "ok", data: fallback.map ? fallback.map(old.data) : (old.data as T), degraded: true };
}
