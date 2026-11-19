/**
 * MCP via Streamable HTTP sem sessão: cada POST traz uma mensagem JSON-RPC (ou um lote) e recebe JSON. Só ferramentas, só leitura.
 * Notificações recebem 202 sem corpo. A autorização final é do banco (`mcp_read`).
 */
import { McpAuthError } from "./rpc";
import { MCP_TOOLS, MCP_TOOL_NAMES } from "./tools";

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
const SERVER = { name: "revela-leitura", title: "Revela · dados do Master (somente leitura)", version: "1.0.0" };
const INSTRUCTIONS = "Dados do console Master do Revela (fotosdocasamento.online), somente leitura: nenhuma ferramenta altera nada. "
  + "Comece por visao_geral e acessos; use eventos/evento_detalhe, pessoas, pagamentos, moderação, saúde e auditoria para detalhes. "
  + "Valores em centavos de real (BRL); datas em ISO 8601.";

type Id = string | number | null;
type Msg = { jsonrpc?: unknown; id?: Id; method?: unknown; params?: unknown };
export type CallTool = (tool: string, args: Record<string, unknown>) => Promise<unknown>;
export type McpResponse = { status: number; body?: unknown };

const ok = (id: Id, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

class AuthFailure extends Error {}

async function one(m: Msg, call: CallTool): Promise<object | null> {
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0" || typeof m.method !== "string") return fail(m?.id ?? null, -32600, "Requisição JSON-RPC inválida");
  if (!("id" in m) || m.id === undefined) return null; // notificação
  const id = m.id;
  const params = (m.params ?? {}) as Record<string, unknown>;
  switch (m.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(asked as never) ? asked : MCP_PROTOCOL_VERSIONS[0];
      return ok(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    }
    case "ping": return ok(id, {});
    case "tools/list": return ok(id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !MCP_TOOL_NAMES.has(name)) return fail(id, -32602, `Ferramenta desconhecida: ${String(name)}`);
      const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments) ? (params.arguments as Record<string, unknown>) : {};
      try {
        const data = await call(name, args);
        const structured = data !== null && typeof data === "object" && !Array.isArray(data) ? data : { dados: data };
        return ok(id, { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: structured, isError: false });
      } catch (e) {
        if (e instanceof McpAuthError) throw new AuthFailure();
        return ok(id, { content: [{ type: "text", text: `Erro ao consultar: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
      }
    }
    default: return fail(id, -32601, `Método não suportado: ${m.method}`);
  }
}

export async function handleMcp(body: unknown, call: CallTool): Promise<McpResponse> {
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Msg[];
  try {
    const out = (await Promise.all(msgs.map((m) => one(m, call)))).filter((r): r is object => r !== null);
    if (out.length === 0) return { status: 202 };
    return { status: 200, body: batch ? out : out[0] };
  } catch (e) {
    if (e instanceof AuthFailure) return { status: 401, body: fail(batch ? null : (msgs[0]?.id ?? null), -32001, "Token inválido ou revogado") };
    throw e;
  }
}
