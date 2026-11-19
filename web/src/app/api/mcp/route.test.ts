import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const req = (body: unknown, auth?: string) => new Request("https://fotosdocasamento.online/api/mcp", {
  method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(auth ? { Authorization: auth } : {}) },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("POST /api/mcp", () => {
  it("sem token: 401 com WWW-Authenticate Bearer", async () => {
    const r = await POST(req(init));
    expect(r.status).toBe(401);
    expect(r.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
  });
  it("token fora do formato: 401 sem consultar o banco", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect((await POST(req(init, "Bearer abc"))).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });
  it("initialize com token: 200 JSON", async () => {
    const r = await POST(req(init, `Bearer mcp_${"a".repeat(64)}`));
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(await r.json()).toMatchObject({ result: { serverInfo: { name: "revela-leitura" } } });
  });
  it("tools/call repassa o token ao banco (mcp_read)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
    const f = vi.fn(async () => new Response(JSON.stringify({ total: 1 }), { status: 200 })); vi.stubGlobal("fetch", f);
    const tok = `mcp_${"b".repeat(64)}`;
    const r = await POST(req({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "acessos", arguments: { dias: 7 } } }, `Bearer ${tok}`));
    expect(await r.json()).toMatchObject({ result: { structuredContent: { total: 1 } } });
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ p_token: tok, p_tool: "acessos", p_args: { dias: 7 } });
  });
  it("JSON inválido: erro de parse JSON-RPC", async () => {
    const r = await POST(req("{nao", `Bearer mcp_${"a".repeat(64)}`));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: { code: -32700 } });
  });
  it("notificação: 202 sem corpo", async () => {
    const r = await POST(req({ jsonrpc: "2.0", method: "notifications/initialized" }, `Bearer mcp_${"a".repeat(64)}`));
    expect(r.status).toBe(202);
    expect(await r.text()).toBe("");
  });
});

describe("GET /api/mcp", () => {
  it("sem fluxo SSE: 405", async () => {
    expect((await GET()).status).toBe(405);
  });
});
