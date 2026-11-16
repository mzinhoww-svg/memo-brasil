import { describe, expect, it, vi } from "vitest";
import { createOptin, resolveWaConfig, sendMessage, WaGatewayError, type WaConfig } from "./wa-gateway";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const cfg = (fetch: WaConfig["fetch"]): WaConfig => ({ baseUrl: "https://gw.example.test", apiKey: "k-test", timeoutMs: 50, fetch });
const SUBJECT = "11111111-1111-4111-8111-111111111111.22222222-2222-4222-8222-222222222222";

describe("resolveWaConfig", () => {
  it("monta a configuração e tira a barra final", () => {
    const r = resolveWaConfig({ WA_GATEWAY_URL: "https://gw.example.test/", WA_GATEWAY_API_KEY: "k" });
    expect(r).toEqual({ baseUrl: "https://gw.example.test", apiKey: "k", timeoutMs: 8000 });
  });
  it.each([
    [{}], [{ WA_GATEWAY_URL: "https://gw.example.test" }], [{ WA_GATEWAY_API_KEY: "k" }],
    [{ WA_GATEWAY_URL: "http://gw.example.test", WA_GATEWAY_API_KEY: "k" }], [{ WA_GATEWAY_URL: "não é url", WA_GATEWAY_API_KEY: "k" }],
    [{ WA_GATEWAY_URL: "https://gw.example.test/v1?x=1", WA_GATEWAY_API_KEY: "k" }],
  ])("recusa configuração incompleta ou insegura %j", (env) => expect(resolveWaConfig(env as Record<string, string>)).toBeNull());
});

describe("createOptin", () => {
  it("envia o contrato fixo e devolve código, validade e link", async () => {
    const f = vi.fn(async () => json({ code: "REV-AB12", expiresAt: "2026-11-16T10:15:00Z", waLink: "https://wa.me/5565999990000?text=Quero%20REV-AB12" }));
    const r = await createOptin(cfg(f as unknown as typeof fetch), { subjectId: SUBJECT, replyText: "Pronto! Volte: https://x.test/e/AAAA2222/voce" });
    expect(r.waLink).toBe("https://wa.me/5565999990000?text=Quero%20REV-AB12");
    expect(r.code).toBe("REV-AB12");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gw.example.test/v1/optin/codes");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("k-test");
    expect(JSON.parse(String(init.body))).toEqual({
      instanceId: "revela", project: "revela", subjectId: SUBJECT, prefix: "REV", ttlMinutes: 15,
      replyText: "Pronto! Volte: https://x.test/e/AAAA2222/voce",
      messageTemplate: "Quero receber os avisos do evento no Revela. Código: {{code}}",
    });
  });
  it("valida os limites antes de chamar a rede", async () => {
    const f = vi.fn();
    const c = cfg(f as unknown as typeof fetch);
    await expect(createOptin(c, { subjectId: "x".repeat(121), replyText: "ok" })).rejects.toMatchObject({ code: "invalid" });
    await expect(createOptin(c, { subjectId: SUBJECT, replyText: "x".repeat(1001) })).rejects.toMatchObject({ code: "invalid" });
    await expect(createOptin(c, { subjectId: SUBJECT, replyText: "ok", messageTemplate: "sem o código" })).rejects.toMatchObject({ code: "invalid" });
    await expect(createOptin(c, { subjectId: SUBJECT, replyText: "ok", messageTemplate: "{{code}} " + "x".repeat(300) })).rejects.toMatchObject({ code: "invalid" });
    expect(f).not.toHaveBeenCalled();
  });
  it("só aceita link wa.me na resposta", async () => {
    for (const waLink of ["https://evil.example/x", "http://wa.me/1", "javascript:alert(1)", "", 7]) {
      const f = vi.fn(async () => json({ code: "REV-1", expiresAt: "x", waLink }));
      await expect(createOptin(cfg(f as unknown as typeof fetch), { subjectId: SUBJECT, replyText: "ok" })).rejects.toMatchObject({ code: "bad_response" });
    }
  });
  it.each([[401, "unauthorized"], [403, "unauthorized"], [400, "invalid"], [429, "rate_limited"], [500, "unavailable"], [503, "unavailable"]])(
    "status %i vira %s", async (status, code) => {
      const f = vi.fn(async () => json({ error: "x" }, status));
      await expect(createOptin(cfg(f as unknown as typeof fetch), { subjectId: SUBJECT, replyText: "ok" })).rejects.toMatchObject({ code, status });
    },
  );
  it("rede caída e tempo esgotado viram erros tipados, sem vazar a chave", async () => {
    const down = vi.fn(async () => { throw new TypeError("fetch failed https://gw.example.test k-test"); });
    const err = await createOptin(cfg(down as unknown as typeof fetch), { subjectId: SUBJECT, replyText: "ok" }).catch((e) => e);
    expect(err).toBeInstanceOf(WaGatewayError);
    expect(err.code).toBe("network");
    expect(String(err.message)).not.toContain("k-test");
    const slow = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))));
    await expect(createOptin(cfg(slow as unknown as typeof fetch), { subjectId: SUBJECT, replyText: "ok" })).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("sendMessage", () => {
  it("devolve o id do 202", async () => {
    const f = vi.fn(async () => json({ id: "msg-1" }, 202));
    expect(await sendMessage(cfg(f as unknown as typeof fetch), { phone: "5565999990000", text: "oi" })).toEqual({ id: "msg-1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gw.example.test/v1/messages");
    expect(JSON.parse(String(init.body))).toEqual({ instanceId: "revela", phone: "5565999990000", text: "oi" });
  });
  it("409 NO_OPT_IN vira no_optin (nunca reenviar)", async () => {
    const f = vi.fn(async () => json({ error: "NO_OPT_IN" }, 409));
    await expect(sendMessage(cfg(f as unknown as typeof fetch), { phone: "5565999990000", text: "oi" })).rejects.toMatchObject({ code: "no_optin", status: 409 });
  });
  it("recusa telefone fora do padrão e texto vazio sem chamar a rede", async () => {
    const f = vi.fn();
    await expect(sendMessage(cfg(f as unknown as typeof fetch), { phone: "(65) 9999", text: "oi" })).rejects.toMatchObject({ code: "invalid" });
    await expect(sendMessage(cfg(f as unknown as typeof fetch), { phone: "5565999990000", text: " " })).rejects.toMatchObject({ code: "invalid" });
    expect(f).not.toHaveBeenCalled();
  });
  it("202 sem id é resposta ruim", async () => {
    const f = vi.fn(async () => json({}, 202));
    await expect(sendMessage(cfg(f as unknown as typeof fetch), { phone: "5565999990000", text: "oi" })).rejects.toMatchObject({ code: "bad_response" });
  });
});
