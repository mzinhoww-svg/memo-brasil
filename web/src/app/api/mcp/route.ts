import { handleMcp } from "@/features/mcp/protocol";
import { callMcpRead } from "@/features/mcp/rpc";
import { supabaseConfig } from "@/lib/supabase/env";

/**
 * MCP somente leitura para o bot do dono: `POST /api/mcp` com `Authorization: Bearer mcp_…` (Streamable HTTP, sem sessão).
 * O token só é repassado; quem confere, limita às funções de leitura e trava a transação em somente leitura é o banco (`mcp_read`).
 */
export const dynamic = "force-dynamic";

const TOKEN = /^mcp_[0-9a-f]{64}$/;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const unauthorized = () => json(401, { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Token ausente ou inválido" } },
  { "WWW-Authenticate": 'Bearer realm="revela-mcp"' });

export async function POST(request: Request): Promise<Response> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN.test(token)) return unauthorized();
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }); }
  const cfg = supabaseConfig();
  const r = await handleMcp(body, async (tool, args) => {
    if (!cfg) throw new Error("banco não configurado");
    return callMcpRead(token, tool, args, cfg);
  });
  if (r.status === 202) return new Response(null, { status: 202 });
  if (r.status === 401) return unauthorized();
  return json(r.status, r.body);
}

export async function GET(): Promise<Response> {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
