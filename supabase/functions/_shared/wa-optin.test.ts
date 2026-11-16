import { describe, expect, it, vi } from "vitest";
import { WaGatewayError } from "./wa-gateway";
import { buildReplyText, handleOptinRequest, parseSubjectId, subjectIdFor, type OptinDeps } from "./wa-optin";

const EV = "11111111-1111-4111-8111-111111111111";
const US = "22222222-2222-4222-8222-222222222222";

const deps = (over: Partial<OptinDeps> = {}): OptinDeps => ({
  userId: US,
  status: vi.fn(async () => ({ enabled: true, eligible: true })),
  rateLimit: vi.fn(async () => true),
  eventCode: vi.fn(async () => "AB23CD45"),
  siteOrigin: "https://app.example.test",
  createOptin: vi.fn(async () => ({ code: "REV-1", expiresAt: "2026-11-16T10:15:00Z", waLink: "https://wa.me/5565999990000?text=x" })),
  ...over,
});

describe("subjectId", () => {
  it("é evento.convidado, parseável e cabe em 120", () => {
    const s = subjectIdFor(EV, US);
    expect(s).toBe(`${EV}.${US}`);
    expect(s.length).toBeLessThanOrEqual(120);
    expect(parseSubjectId(s)).toEqual({ eventId: EV, userId: US });
  });
  it.each(["", "abc", `${EV}`, `${EV}.${US}.x`, `${EV}.nao-uuid`, `x${EV}.${US}`, "a".repeat(200)])("recusa %s", (s) => expect(parseSubjectId(s)).toBeNull());
});

describe("buildReplyText", () => {
  it("leva o deep link de volta ao evento e cabe em 1000", () => {
    const t = buildReplyText("https://app.example.test", "AB23CD45");
    expect(t).toBe("Pronto! Avisos do Revela ativados 🎉 Volte ao evento: https://app.example.test/e/AB23CD45/voce");
    expect(t.length).toBeLessThanOrEqual(1000);
  });
});

describe("handleOptinRequest", () => {
  it("devolve só o waLink", async () => {
    const d = deps();
    const r = await handleOptinRequest({ eventId: EV }, d);
    expect(r).toEqual({ status: 200, body: { waLink: "https://wa.me/5565999990000?text=x" } });
    expect(d.createOptin).toHaveBeenCalledWith({ subjectId: `${EV}.${US}`, replyText: "Pronto! Avisos do Revela ativados 🎉 Volte ao evento: https://app.example.test/e/AB23CD45/voce" });
  });
  it("sem sessão: 401", async () => {
    expect((await handleOptinRequest({ eventId: EV }, deps({ userId: null }))).status).toBe(401);
  });
  it.each([undefined, null, "", "x", 7, `${EV}; drop`])("eventId inválido %s: 400", async (eventId) => {
    const d = deps();
    expect((await handleOptinRequest({ eventId }, d)).status).toBe(400);
    expect(d.createOptin).not.toHaveBeenCalled();
  });
  it("recurso desligado: 503 sem chamar o gateway", async () => {
    const d = deps({ status: vi.fn(async () => ({ enabled: false, eligible: true })) });
    expect(await handleOptinRequest({ eventId: EV }, d)).toEqual({ status: 503, body: { error: "indisponivel" } });
    expect(d.createOptin).not.toHaveBeenCalled();
  });
  it("não participante ou bloqueado (o banco diz eligible=false): 403", async () => {
    const d = deps({ status: vi.fn(async () => ({ enabled: true, eligible: false })) });
    expect((await handleOptinRequest({ eventId: EV }, d)).status).toBe(403);
    expect(d.createOptin).not.toHaveBeenCalled();
  });
  it("evento alheio (o banco recusa): 403", async () => {
    const d = deps({ status: vi.fn(async () => { throw Object.assign(new Error("forbidden"), { code: "MM004" }); }) });
    expect((await handleOptinRequest({ eventId: EV }, d)).status).toBe(403);
  });
  it("limite de pedidos: 429 antes de gastar um código", async () => {
    const d = deps({ rateLimit: vi.fn(async () => false) });
    expect((await handleOptinRequest({ eventId: EV }, d)).status).toBe(429);
    expect(d.createOptin).not.toHaveBeenCalled();
  });
  it("evento sem código legível: 404", async () => {
    expect((await handleOptinRequest({ eventId: EV }, deps({ eventCode: vi.fn(async () => null) }))).status).toBe(404);
  });
  it.each(["timeout", "network", "unavailable", "unauthorized", "rate_limited", "bad_response", "invalid"] as const)(
    "gateway com erro %s: 502 amigável, sem detalhe interno", async (code) => {
      const r = await handleOptinRequest({ eventId: EV }, deps({ createOptin: vi.fn(async () => { throw new WaGatewayError(code); }) }));
      expect(r).toEqual({ status: 502, body: { error: "gateway_indisponivel" } });
    },
  );
  it("falha ao ler o estado: 503, não 500 cru", async () => {
    const d = deps({ status: vi.fn(async () => { throw new Error("db down"); }) });
    expect((await handleOptinRequest({ eventId: EV }, d)).status).toBe(503);
  });
});
