import { describe, expect, it, vi } from "vitest";
import { WaGatewayError } from "./wa-gateway";
import { buildMessageTemplate, buildReplyText, cleanTitle, handleOptinRequest, newReturnToken, parseSubjectId, RETURN_TOKEN_RE, sha256Hex, subjectIdFor, type OptinDeps } from "./wa-optin";

const EV = "11111111-1111-4111-8111-111111111111";
const US = "22222222-2222-4222-8222-222222222222";
const TOKEN = "A".repeat(43);

const deps = (over: Partial<OptinDeps> = {}): OptinDeps => ({
  userId: US,
  status: vi.fn(async () => ({ enabled: true, eligible: true })),
  rateLimit: vi.fn(async () => true),
  eventInfo: vi.fn(async () => ({ code: "AB23CD45", title: "Casamento Ana & Leo" })),
  issueReturnToken: vi.fn(async () => undefined),
  newToken: () => TOKEN,
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

describe("mensagens com o nome do evento", () => {
  it("resposta do bot: nome do evento + link de volta com token, cabe em 1000", () => {
    const t = buildReplyText("https://app.example.test", "AB23CD45", "Casamento Ana & Leo", TOKEN);
    expect(t).toBe(`Pronto! Avisos de "Casamento Ana & Leo" ativados 🎉 Volte ao evento: https://app.example.test/e/AB23CD45/voltar?r=${TOKEN}`);
    expect(buildReplyText("https://a.test", "X", "t".repeat(500), TOKEN).length).toBeLessThanOrEqual(1000);
  });
  it("mensagem pronta: nome do evento e {{code}}, cabe em 300", () => {
    const m = buildMessageTemplate("Casamento Ana & Leo");
    expect(m).toBe('Quero receber os avisos de "Casamento Ana & Leo" no Revela. Código: {{code}}');
    expect(buildMessageTemplate("x".repeat(500)).length).toBeLessThanOrEqual(300);
    expect(buildMessageTemplate("")).toContain("{{code}}");
  });
  it("título saneado: sem aspas, chaves, quebras; no máximo 80", () => {
    expect(cleanTitle('Festa "da Bia"\n{{code}}')).toBe("Festa da Bia code");
    expect(cleanTitle("a".repeat(120))).toHaveLength(80);
    expect(buildReplyText("https://a.test", "X", "", TOKEN)).toContain("Avisos do Revela ativados");
  });
  it("token de volta: 43 caracteres base64url, aleatório; o banco recebe só o SHA-256", async () => {
    const a = newReturnToken(), b = newReturnToken();
    expect(a).toMatch(RETURN_TOKEN_RE);
    expect(a).not.toBe(b);
    expect(await sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("handleOptinRequest", () => {
  it("devolve só o waLink", async () => {
    const d = deps();
    const r = await handleOptinRequest({ eventId: EV }, d);
    expect(r).toEqual({ status: 200, body: { waLink: "https://wa.me/5565999990000?text=x", expiresAt: "2026-11-16T10:15:00Z" } });
    expect(d.createOptin).toHaveBeenCalledWith({
      subjectId: `${EV}.${US}`,
      replyText: `Pronto! Avisos de "Casamento Ana & Leo" ativados 🎉 Volte ao evento: https://app.example.test/e/AB23CD45/voltar?r=${TOKEN}`,
      messageTemplate: 'Quero receber os avisos de "Casamento Ana & Leo" no Revela. Código: {{code}}',
    });
    expect(d.issueReturnToken).toHaveBeenCalledWith(EV, US, await sha256Hex(TOKEN)); // nunca o token em si
  });
  it("falha ao guardar o token: 503 sem gastar código no gateway", async () => {
    const d = deps({ issueReturnToken: vi.fn(async () => { throw new Error("db"); }) });
    expect((await handleOptinRequest({ eventId: EV }, d)).status).toBe(503);
    expect(d.createOptin).not.toHaveBeenCalled();
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
    expect((await handleOptinRequest({ eventId: EV }, deps({ eventInfo: vi.fn(async () => null) }))).status).toBe(404);
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
