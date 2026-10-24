import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rpcErrorKind } from "./params";
import { callRpc, callRpcOr, type RpcClient } from "./rpc";

/** Mensagens reais do PostgREST local (PGRST202). */
const MISSING = {
  code: "PGRST202",
  details: "Searched for the function public.admin_overview with parameters p_days, p_include_tests or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
  hint: null,
  message: "Could not find the function public.admin_overview(p_days, p_include_tests) in the schema cache",
};
const MISSING_OTHER_HINT = { ...MISSING, hint: "Perhaps you meant to call the function public.admin_overview_old" };
const MISMATCH = {
  code: "PGRST202",
  details: "Searched for the function public.admin_overview with parameters p_dias or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.",
  hint: "Perhaps you meant to call the function public.admin_overview(p_days, p_include_tests)",
  message: "Could not find the function public.admin_overview(p_dias) in the schema cache",
};

function client(responses: Record<string, { data?: unknown; error?: unknown }>): RpcClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    rpc: async (name: string) => { calls.push(name); const r = responses[name] ?? { data: null }; return { data: r.data ?? null, error: (r.error ?? null) as never }; },
  };
}

describe("rpcErrorKind", () => {
  it("função inexistente: missing", () => {
    expect(rpcErrorKind(MISSING, "admin_overview")).toBe("missing");
    expect(rpcErrorKind(MISSING_OTHER_HINT, "admin_overview")).toBe("missing");
    expect(rpcErrorKind({ code: "42883", message: "function public.admin_overview(integer) does not exist" }, "admin_overview")).toBe("missing");
  });
  it("mesma função com outra assinatura (dica cita a própria função): mismatch", () => {
    expect(rpcErrorKind(MISMATCH, "admin_overview")).toBe("mismatch");
  });
  it("erro que cita outra função ou não é de função: other", () => {
    expect(rpcErrorKind({ ...MISSING, message: "Could not find the function public.outra(p_x) in the schema cache" }, "admin_overview")).toBe("other");
    expect(rpcErrorKind({ code: "42883", message: "function public.helper(uuid) does not exist" }, "admin_overview")).toBe("other");
    expect(rpcErrorKind({ code: "MM004", message: "forbidden" }, "admin_overview")).toBe("other");
    expect(rpcErrorKind(null, "admin_overview")).toBe("other");
  });
});

describe("callRpcOr", () => {
  const env = process.env.NODE_ENV;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); vi.stubEnv("NODE_ENV", env ?? "test"); vi.unstubAllEnvs(); });

  it("ok: não chama o fallback", async () => {
    const c = client({ admin_overview: { data: { a: 1 } } });
    expect(await callRpcOr(c, "admin_overview", {}, { name: "admin_stats" })).toEqual({ state: "ok", data: { a: 1 } });
    expect(c.calls).toEqual(["admin_overview"]);
  });

  it("função inexistente: cai no fallback, degraded e console.warn com o nome da RPC", async () => {
    const c = client({ admin_overview: { error: MISSING }, admin_stats: { data: [1] } });
    expect(await callRpcOr(c, "admin_overview", {}, { name: "admin_stats" })).toEqual({ state: "ok", data: [1], degraded: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("admin_overview");
  });

  it("argumento errado em desenvolvimento: erro, sem fallback", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const c = client({ admin_overview: { error: MISMATCH }, admin_stats: { data: [1] } });
    const r = await callRpcOr(c, "admin_overview", {}, { name: "admin_stats" });
    expect(r.state).toBe("error");
    expect(r.state === "error" && r.message).toContain("admin_overview");
    expect(c.calls).toEqual(["admin_overview"]);
  });

  it("argumento errado em produção: fallback degradado com console.warn", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const c = client({ admin_overview: { error: MISMATCH }, admin_stats: { data: [1] } });
    expect(await callRpcOr(c, "admin_overview", {}, { name: "admin_stats" })).toEqual({ state: "ok", data: [1], degraded: true });
    expect(String(warn.mock.calls[0][0])).toContain("admin_overview");
  });

  it("outros erros não caem no fallback", async () => {
    const c = client({ admin_overview: { error: { code: "MM004", message: "forbidden" } } });
    expect(await callRpcOr(c, "admin_overview", {}, { name: "admin_stats" })).toEqual({ state: "denied" });
    const d = client({ admin_overview: { error: { code: "XX000", message: "boom" } } });
    expect(await callRpcOr(d, "admin_overview", {}, { name: "admin_stats" })).toEqual({ state: "error", message: "boom" });
    expect(d.calls).toEqual(["admin_overview"]);
  });

  it("callRpc traduz forbidden", async () => {
    expect(await callRpc(client({ x: { error: { code: "MM004", message: "forbidden" } } }), "x")).toEqual({ state: "denied" });
  });
});
