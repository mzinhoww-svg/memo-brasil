import "server-only";
import { notFound } from "next/navigation";
import { masterAccess } from "@/lib/master/server";

export type Load<T> = { state: "ok"; data: T } | { state: "denied" } | { state: "error"; message: string };
type Sb = NonNullable<Awaited<ReturnType<typeof masterAccess>>["sb"]>;

/** Cada página reconfirma o acesso no servidor (layouts não rodam de novo em navegação suave). */
export async function requireMaster(): Promise<Sb> {
  const { access, sb } = await masterAccess();
  if (access !== "ok" || !sb) notFound();
  return sb;
}

/** Chama uma RPC administrativa; a autorização final é do banco (`is_platform_staff()`), aqui só se traduz o erro. */
export async function rpc<T>(sb: Sb, name: string, args?: Record<string, unknown>): Promise<Load<T>> {
  const { data, error } = await sb.rpc(name, args ?? {});
  if (!error) return { state: "ok", data: data as T };
  if (error.code === "MM004" || /forbidden/i.test(error.message)) return { state: "denied" };
  return { state: "error", message: error.message };
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
