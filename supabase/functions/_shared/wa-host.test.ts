import { describe, expect, it, vi } from "vitest";
<<<<<<< HEAD
import { buildHostMessage, eventLink, handleHostOptinRequest, hostSubjectId, parseHostSubject, recoveryLink, SALES_WA, type HostItem } from "./wa-host";
=======
import { buildHostMessage, handleHostOptinRequest, hostSubjectId, parseHostSubject, recoveryLink, SALES_WA, type HostItem } from "./wa-host";
>>>>>>> origin/claude/pensive-wozniak-4w2wpo
import { parseSubjectId } from "./wa-optin";
import { runDispatch } from "./wa-dispatch";

const O = "https://fotosdocasamento.online";
const item = (over: Partial<HostItem> = {}): HostItem => ({
  id: 7, kind: "pedido_1h", phone: "5565999990000", host_name: "Ana", event_id: "11111111-1111-4111-8111-111111111111",
  event_title: "Casamento Ana e Beto", event_code: "AB23CD45", plan_code: "ate150", attempts: 1, ...over,
});

describe("subject do anfitrião", () => {
  const uid = "22222222-2222-4222-8222-222222222222";
  it("host.<user_id> ida e volta, sem dado pessoal", () => {
    expect(hostSubjectId(uid)).toBe(`host.${uid}`);
    expect(parseHostSubject(`host.${uid}`)).toEqual({ userId: uid });
  });
  it("não confunde com o subject do convidado (evento.usuário)", () => {
    expect(parseHostSubject(`${uid}.${uid}`)).toBeNull();
    expect(parseSubjectId(`host.${uid}`)).toBeNull();
    expect(parseHostSubject("host.lixo")).toBeNull();
  });
});

describe("mensagens de recuperação de pedido", () => {
  it("link reabre o plano do evento com a faixa escolhida e marca a origem", () => {
    expect(recoveryLink(O, item())).toBe(`${O}/painel/11111111-1111-4111-8111-111111111111/plano?plano=ate150&utm_source=whatsapp&utm_medium=recuperacao&utm_campaign=pedido_1h`);
  });
  it("1 h: nome, link e saída; sem promessa de atendimento por resposta", () => {
    const t = buildHostMessage(item(), O)!;
    expect(t).toMatch(/^Oi, Ana!/);
    expect(t).toContain("pagamento da câmera do seu evento não foi concluído");
    expect(t).toContain(recoveryLink(O, item()));
    expect(t).toContain("responda SAIR");
    expect(t).not.toMatch(/responde esta mensagem/);
    expect(t).toContain("Dúvidas? Fale com a gente: https://wa.me/5565996227110");
  });
  it("24 h: nome do evento e a opção de seguir no grátis", () => {
    const t = buildHostMessage(item({ kind: "pedido_24h" }), O)!;
    expect(t).toContain('a câmera de "Casamento Ana e Beto" continua pronta');
    expect(t).toContain("seguir no plano grátis");
    expect(t).toContain("utm_campaign=pedido_24h");
    expect(t).toContain(SALES_WA);
    expect(t).toContain("responda SAIR");
  });
  it("sem nome: saudação neutra; título com aspas/quebras é limpo", () => {
    expect(buildHostMessage(item({ host_name: null }), O)).toMatch(/^Oi!/);
    expect(buildHostMessage(item({ kind: "pedido_24h", event_title: 'A "B"\n\nC' }), O)).toContain('"A B C"');
  });
  it("tipo desconhecido não vira mensagem", () => {
    expect(buildHostMessage(item({ kind: "outro" }), O)).toBeNull();
  });
  it("o laço de envio comum aceita os itens do anfitrião", async () => {
    const send = vi.fn(async () => ({ id: "gw" }));
    const mark = vi.fn(async () => undefined);
    const r = await runDispatch<HostItem>({
      enabled: async () => true, claim: async () => [item()], send, mark, revoke: async () => undefined,
      sleep: async () => undefined, siteOrigin: O, batch: 4, hourlyCap: 55, maxAttempts: 5, build: buildHostMessage,
    });
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledWith({ phone: "5565999990000", text: buildHostMessage(item(), O) });
    expect(mark).toHaveBeenCalledWith(item(), "enviado", { gatewayId: "gw" });
  });
});

<<<<<<< HEAD
describe("ativação do evento grátis", () => {
  const ev = (kind: string, over: Partial<HostItem> = {}) => item({ kind, plan_code: null, ...over });
  it("logo depois de criar: QR com origem marcada, contato e saída", () => {
    const t = buildHostMessage(ev("ativ_criado"), O)!;
    expect(t).toMatch(/^Sua câmera "Casamento Ana e Beto" está pronta!/);
    expect(t).toContain(`${O}/painel/11111111-1111-4111-8111-111111111111/qr?utm_source=whatsapp&utm_medium=ativacao&utm_campaign=ativ_criado`);
    expect(t).toContain(SALES_WA);
    expect(t).toContain("responda SAIR");
  });
  it("3 dias antes e véspera falam do QR", () => {
    expect(buildHostMessage(ev("ativ_3d"), O)).toMatch(/^Faltam 3 dias para o Casamento Ana e Beto! Já espalhou o QR\?/);
    const v = buildHostMessage(ev("ativ_vespera"), O)!;
    expect(v).toMatch(/^Amanhã é o grande dia: Casamento Ana e Beto!/);
    expect(v).toContain("/qr?");
  });
  it("dia seguinte leva ao plano (mais convidados e poses)", () => {
    const t = buildHostMessage(ev("ativ_dia_seguinte"), O)!;
    expect(t).toContain("liberar mais convidados e mais poses");
    expect(t).toContain(eventLink(O, ev("ativ_dia_seguinte"), "plano"));
  });
  it("sem título: frase neutra; nenhuma mensagem tem dado de convidado", () => {
    expect(buildHostMessage(ev("ativ_3d", { event_title: "" }), O)).toMatch(/^Faltam 3 dias para o seu evento!/);
    for (const k of ["ativ_criado", "ativ_3d", "ativ_vespera", "ativ_dia_seguinte"]) {
      expect(buildHostMessage(ev(k), O)).not.toContain("5565999990000");
    }
  });
});

=======
>>>>>>> origin/claude/pensive-wozniak-4w2wpo
describe("pedido de opt-in do anfitrião", () => {
  const base = {
    userId: "22222222-2222-4222-8222-222222222222",
    status: vi.fn(async () => ({ enabled: true })),
    rateLimit: vi.fn(async () => true),
    siteOrigin: O,
    createOptin: vi.fn(async () => ({ waLink: "https://wa.me/5565000000000?text=x", expiresAt: "2026-11-22T10:00:00Z" })),
  };
  it("gera o link wa.me com subject host.<user_id> e texto próprio de anfitrião", async () => {
    const r = await handleHostOptinRequest(base);
    expect(r).toEqual({ status: 200, body: { waLink: "https://wa.me/5565000000000?text=x", expiresAt: "2026-11-22T10:00:00Z" } });
    const arg = (base.createOptin.mock.calls[0] as unknown as [{ subjectId: string; replyText: string; messageTemplate: string }])[0];
    expect(arg.subjectId).toBe("host.22222222-2222-4222-8222-222222222222");
    expect(arg.messageTemplate).toContain("{{code}}");
    expect(arg.replyText).toContain("SAIR");
    expect(arg.replyText).toContain(`${O}/eventos`);
  });
  it("sem sessão: 401; recurso desligado: 503; muitas tentativas: 429", async () => {
    expect((await handleHostOptinRequest({ ...base, userId: null })).status).toBe(401);
    expect((await handleHostOptinRequest({ ...base, status: async () => ({ enabled: false }) })).status).toBe(503);
    expect((await handleHostOptinRequest({ ...base, rateLimit: async () => false })).status).toBe(429);
  });
});
