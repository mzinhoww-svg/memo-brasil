import { describe, expect, it, vi } from "vitest";
import { WaGatewayError } from "./wa-gateway.ts";
import { buildOfferText, handleFunnelLead, leadSubjectId, LEAD_MESSAGE_TEMPLATE, offerLink, parseLeadInput, parseLeadSubject, type FunnelLeadDeps } from "./wa-funnel.ts";
import { handleWaWebhook } from "./wa-webhook.ts";

const LEAD = "11111111-2222-4333-8444-555555555555";
const TERMS = { priceCents: 1990, maxGuests: 50, minutes: 30 };
const deps = (over: Partial<FunnelLeadDeps> = {}): FunnelLeadDeps => ({
  rateLimit: async () => true,
  createLead: async () => ({ leadId: LEAD, expiresAt: "2026-11-23T12:30:00Z" }),
  terms: async () => TERMS,
  siteOrigin: "https://fotosdocasamento.online",
  createOptin: async () => ({ waLink: "https://wa.me/5565000000000?text=x" }),
  ...over,
});

describe("lead do funil", () => {
  it("subject vai e volta, e não se confunde com o do convidado nem com o do anfitrião", () => {
    expect(parseLeadSubject(leadSubjectId(LEAD))).toEqual({ leadId: LEAD });
    expect(parseLeadSubject(`host.${LEAD}`)).toBeNull();
    expect(parseLeadSubject(`${LEAD}.${LEAD}`)).toBeNull();
    expect(parseLeadSubject("lead.nao-e-uuid")).toBeNull();
  });

  it("aceita só o que o quiz sabe e recusa formatos estranhos", () => {
    expect(parseLeadInput({ quiz: "sinais", profile: "pista", guests: 130, source: " Instagram ", medium: "social", campaign: null }))
      .toEqual({ quiz: "sinais", profile: "pista", guests: 130, source: "Instagram", medium: "social", campaign: null, whatsapp: true });
    expect(parseLeadInput({ quiz: "direto", whatsapp: false })?.whatsapp).toBe(false);
    for (const bad of [null, [], { quiz: "Com Espaço" }, { quiz: "ok", profile: "<x>" }, { quiz: "ok", guests: 0 }, { quiz: "ok", guests: 1.5 }, { quiz: "ok", guests: "130" }]) {
      expect(parseLeadInput(bad)).toBeNull();
    }
  });

  it("o texto da oferta traz preço, convidados, prazo, link com origem e a saída, dentro do limite do gateway", () => {
    const t = buildOfferText({ origin: "https://fotosdocasamento.online", leadId: LEAD, quiz: "sinais", guests: 130, terms: TERMS });
    expect(t).toContain("até 50 convidados por R$ 19,90 no Pix");
    expect(t).toContain("Vale por 30 minutos");
    expect(t).toContain("festa de 130 convidados");
    expect(t).toContain("pagando só a diferença"); // festa maior que a oferta
    expect(t).toContain(offerLink("https://fotosdocasamento.online", LEAD, "sinais"));
    expect(t).toContain(`l=${LEAD}`);
    expect(t).toContain("utm_campaign=sinais");
    expect(t).toContain("responda SAIR");
    expect(t.length).toBeLessThanOrEqual(1000);
    const small = buildOfferText({ origin: "https://x.test", leadId: LEAD, quiz: "rapido", guests: 40, terms: TERMS });
    expect(small).not.toContain("pagando só a diferença");
    expect(buildOfferText({ origin: "https://x.test", leadId: LEAD, quiz: "direto", guests: null, terms: TERMS })).toContain("Num casamento");
  });

  it("cria o lead e devolve o link do WhatsApp com o texto da oferta como resposta do bot", async () => {
    const createOptin = vi.fn().mockResolvedValue({ waLink: "https://wa.me/5565000000000?text=x" });
    const r = await handleFunnelLead({ quiz: "sinais", profile: "pista", guests: 130 }, deps({ createOptin }));
    expect(r).toEqual({ status: 200, body: { leadId: LEAD, expiresAt: "2026-11-23T12:30:00Z", waLink: "https://wa.me/5565000000000?text=x" } });
    const sent = createOptin.mock.calls[0][0];
    expect(sent.subjectId).toBe(`lead.${LEAD}`);
    expect(sent.messageTemplate).toBe(LEAD_MESSAGE_TEMPLATE);
    expect(sent.messageTemplate).toContain("{{code}}");
    expect(sent.replyText).toContain("R$ 19,90");
  });

  it("gateway fora do ar ou sem configuração não perde o lead; entrada direta não pede WhatsApp", async () => {
    const down = await handleFunnelLead({ quiz: "sinais" }, deps({ createOptin: async () => { throw new WaGatewayError("unavailable", 503); } }));
    expect(down).toEqual({ status: 200, body: { leadId: LEAD, expiresAt: "2026-11-23T12:30:00Z", waLink: null } });
    expect((await handleFunnelLead({ quiz: "sinais" }, deps({ createOptin: null }))).body.waLink).toBeNull();
    const createOptin = vi.fn();
    expect((await handleFunnelLead({ quiz: "direto", whatsapp: false }, deps({ createOptin }))).body.waLink).toBeNull();
    expect(createOptin).not.toHaveBeenCalled();
  });

  it("entrada inválida e excesso de tentativas não criam lead", async () => {
    const createLead = vi.fn();
    expect((await handleFunnelLead({ quiz: "!!" }, deps({ createLead }))).status).toBe(400);
    expect((await handleFunnelLead({ quiz: "sinais" }, deps({ createLead, rateLimit: async () => false }))).status).toBe(429);
    expect(createLead).not.toHaveBeenCalled();
  });
});

describe("webhook: opt-in de lead", () => {
  const secret = "segredo-de-teste";
  async function sign(raw: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    return `sha256=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  const event = (type: string) => JSON.stringify({ type, project: "revela", instanceId: "revela", subjectId: `lead.${LEAD}`, phone: "5565999990000", at: "2026-11-23T12:01:00Z" });

  it("confirmação marca o contato do lead sem passar o telefone adiante", async () => {
    const raw = event("optin.confirmed");
    const applyLead = vi.fn().mockResolvedValue("applied");
    const apply = vi.fn();
    const r = await handleWaWebhook({ raw, signature: await sign(raw), secret, apply, applyLead });
    expect(r).toEqual({ status: 200, body: { ok: true, outcome: "applied" } });
    expect(applyLead).toHaveBeenCalledWith({ leadId: LEAD, at: "2026-11-23T12:01:00Z" });
    expect(apply).not.toHaveBeenCalled();
  });

  it("SAIR de um lead é ignorado (não há aviso a cancelar) e, sem tratador de lead, o subject é ignorado", async () => {
    const revoked = event("optin.revoked");
    const applyLead = vi.fn();
    expect((await handleWaWebhook({ raw: revoked, signature: await sign(revoked), secret, apply: vi.fn(), applyLead })).body).toEqual({ ok: true, ignored: "type" });
    expect(applyLead).not.toHaveBeenCalled();
    const raw = event("optin.confirmed");
    expect((await handleWaWebhook({ raw, signature: await sign(raw), secret, apply: vi.fn() })).body).toEqual({ ok: true, ignored: "subject" });
  });
});
