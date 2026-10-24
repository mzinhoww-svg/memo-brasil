import "server-only";
import { notFound } from "next/navigation";
import { masterAccess } from "@/lib/master/server";
import { callRpc, callRpcOr, type Fallback, type Load, type RpcClient } from "@/features/master/rpc";

export { includeTests, periodDays, isMissingRpc, type Period, type SearchParams } from "@/features/master/params";
export type { Load } from "@/features/master/rpc";
type Sb = NonNullable<Awaited<ReturnType<typeof masterAccess>>["sb"]>;

/** Cada página reconfirma o acesso no servidor (layouts não rodam de novo em navegação suave). */
export async function requireMaster(): Promise<Sb> {
  const { access, sb } = await masterAccess();
  if (access !== "ok" || !sb) notFound();
  return sb;
}

/** Chama uma RPC administrativa; a autorização final é do banco (`is_platform_staff()`), aqui só se traduz o erro. */
export async function rpc<T>(sb: Sb, name: string, args?: Record<string, unknown>): Promise<Load<T>> {
  return callRpc<T>(sb as unknown as RpcClient, name, args);
}

/**
 * Chama a RPC nova; só se ela não existe no banco (migration não aplicada) chama a antiga e devolve `degraded: true`
 * para a página avisar "Dados completos após a atualização do banco". Regras em `callRpcOr`.
 */
export async function rpcOr<T>(sb: Sb, name: string, args: Record<string, unknown>, fallback: Fallback<T>): Promise<Load<T>> {
  return callRpcOr<T>(sb as unknown as RpcClient, name, args, fallback);
}

export const num = (n: number | null | undefined) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
export const bytes = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} B`;
  const u = ["KB", "MB", "GB", "TB"]; let i = -1; let x = v;
  do { x /= 1024; i++; } while (x >= 1024 && i < u.length - 1);
  return `${x.toFixed(x < 10 ? 1 : 0).replace(".", ",")} ${u[i]}`;
};
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Cuiaba", dateStyle: "short", timeStyle: "short" }) : "—");

/** Janela [agora - dias, agora] em ISO (fora dos componentes: renderização pura). */
export const window = (dias: number) => ({ p_from: new Date(Date.now() - dias * 86_400_000).toISOString(), p_to: new Date().toISOString() });
