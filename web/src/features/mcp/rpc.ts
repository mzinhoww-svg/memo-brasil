/** Chamada ao banco: `mcp_read` com a chave pública; o banco confere o token e garante a leitura (transação somente leitura). */
import type { SupabaseConfig } from "@/lib/supabase/env";

export class McpAuthError extends Error {
  constructor() { super("token inválido ou revogado"); this.name = "McpAuthError"; }
}

export async function callMcpRead(token: string, tool: string, args: Record<string, unknown>, cfg: SupabaseConfig, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/mcp_read`, {
    method: "POST",
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_tool: tool, p_args: args }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
  if (res.ok) return data;
  if (data?.code === "MM004") throw new McpAuthError();
  throw new Error(data?.message || `erro ${res.status} do banco`);
}
