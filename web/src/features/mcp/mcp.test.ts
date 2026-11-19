import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleMcp } from "./protocol";
import { McpAuthError, callMcpRead } from "./rpc";
import { MCP_TOOLS } from "./tools";

const MIGRATION = readFileSync(join(__dirname, "../../../../supabase/migrations/20261121000100_mcp_leitura.sql"), "utf8");
const rpc = (method: string, params?: unknown, id: number | string = 1) => ({ jsonrpc: "2.0", id, method, params });

describe("catálogo de ferramentas", () => {
  it("é exatamente a lista fechada do banco (mesmos nomes, mesma ordem)", () => {
    const sqlTools = [...MIGRATION.matchAll(/when '([a-z_]+)' then/g)].map((m) => m[1]);
    expect(MCP_TOOLS.map((t) => t.name)).toEqual(sqlTools);
  });
  it("nenhuma ferramenta tem nome ou descrição de escrita", () => {
    for (const t of MCP_TOOLS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.name).not.toMatch(/criar|apagar|alterar|definir|revelar_agora|reembolso|moderar|exportar|codigo/);
      expect(t.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
      expect(t.inputSchema.type).toBe("object");
    }
  });
});

describe("protocolo MCP (Streamable HTTP sem sessão)", () => {
  const call = vi.fn<(tool: string, args: Record<string, unknown>) => Promise<unknown>>(async () => ({ ok: true }));

  it("initialize: negocia a versão, anuncia só ferramentas e diz que é somente leitura", async () => {
    const r = await handleMcp(rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "openbot", version: "1" } }), call);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "revela-leitura" } } });
    expect(JSON.stringify(r.body)).toMatch(/somente leitura/);
  });
  it("initialize com versão desconhecida responde a mais recente suportada", async () => {
    const r = await handleMcp(rpc("initialize", { protocolVersion: "1999-01-01" }), call);
    expect((r.body as { result: { protocolVersion: string } }).result.protocolVersion).toBe("2025-06-18");
  });
  it("notificação: 202 sem corpo", async () => {
    const r = await handleMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, call);
    expect(r).toEqual({ status: 202 });
  });
  it("ping e tools/list", async () => {
    expect((await handleMcp(rpc("ping"), call)).body).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    const list = (await handleMcp(rpc("tools/list"), call)).body as { result: { tools: unknown[] } };
    expect(list.result.tools).toHaveLength(MCP_TOOLS.length);
  });
  it("tools/call: chama o banco e devolve texto JSON + structuredContent", async () => {
    call.mockResolvedValueOnce({ eventos: 3 });
    const r = await handleMcp(rpc("tools/call", { name: "visao_geral", arguments: { dias: 7 } }), call);
    expect(call).toHaveBeenCalledWith("visao_geral", { dias: 7 });
    expect(r.body).toMatchObject({ result: { content: [{ type: "text", text: '{"eventos":3}' }], structuredContent: { eventos: 3 }, isError: false } });
  });
  it("tools/call com lista: structuredContent embrulha em { dados }", async () => {
    call.mockResolvedValueOnce([{ a: 1 }]);
    const r = await handleMcp(rpc("tools/call", { name: "planos" }), call);
    expect(r.body).toMatchObject({ result: { structuredContent: { dados: [{ a: 1 }] } } });
  });
  it("ferramenta fora do catálogo nunca chega ao banco", async () => {
    call.mockClear();
    const r = await handleMcp(rpc("tools/call", { name: "admin_set_plan", arguments: {} }), call);
    expect(call).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ error: { code: -32602 } });
  });
  it("token recusado pelo banco vira HTTP 401", async () => {
    const r = await handleMcp(rpc("tools/call", { name: "saude" }), async () => { throw new McpAuthError(); });
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ error: { code: -32001 } });
  });
  it("erro do banco vira resultado com isError (o bot vê a mensagem)", async () => {
    const r = await handleMcp(rpc("tools/call", { name: "evento_detalhe", arguments: { evento_id: "x" } }), async () => { throw new Error("invalid input syntax for type uuid"); });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ result: { isError: true, content: [{ type: "text" }] } });
  });
  it("método desconhecido e corpo inválido", async () => {
    expect((await handleMcp(rpc("resources/list"), call)).body).toMatchObject({ error: { code: -32601 } });
    expect((await handleMcp("lixo", call)).body).toMatchObject({ error: { code: -32600 } });
  });
  it("lote: responde cada requisição, ignora notificações", async () => {
    const r = await handleMcp([rpc("ping", undefined, 1), { jsonrpc: "2.0", method: "notifications/initialized" }, rpc("ping", undefined, 2)], call);
    expect(r.body).toEqual([{ jsonrpc: "2.0", id: 1, result: {} }, { jsonrpc: "2.0", id: 2, result: {} }]);
  });
});

describe("chamada ao banco (mcp_read)", () => {
  const cfg = { url: "https://x.supabase.co", key: "pub" };
  it("POST em /rest/v1/rpc/mcp_read com a chave pública e o token no corpo", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    expect(await callMcpRead("mcp_tok", "saude", { a: 1 }, cfg, f as unknown as typeof fetch)).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledWith("https://x.supabase.co/rest/v1/rpc/mcp_read", expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ apikey: "pub" }), body: JSON.stringify({ p_token: "mcp_tok", p_tool: "saude", p_args: { a: 1 } }),
    }));
  });
  it("MM004 do banco vira McpAuthError", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ code: "MM004", message: "forbidden" }), { status: 400 }));
    await expect(callMcpRead("t", "saude", {}, cfg, f as unknown as typeof fetch)).rejects.toBeInstanceOf(McpAuthError);
  });
  it("outros erros viram Error com a mensagem do banco", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ code: "22P02", message: "invalid input syntax for type uuid" }), { status: 400 }));
    await expect(callMcpRead("t", "evento_detalhe", {}, cfg, f as unknown as typeof fetch)).rejects.toThrow("invalid input syntax for type uuid");
  });
});
