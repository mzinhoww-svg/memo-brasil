import { describe, expect, it } from "vitest";
import { guestsOf, planText, reasonRows, revealRows, toDetalheProps, type EventDetail } from "./detail";

const base: EventDetail = {
  event: { id: "e1", title: "Ana & Leo", category: "casamento", hostName: "Ana Ribeiro", status: "ativo", startAt: "2027-03-14T20:30:00Z", endAt: "2027-03-15T06:00:00Z", createdAt: "2026-11-03T13:14:00Z", deletedAt: null,
    revealEnabled: true, revealAt: "2027-03-15T16:00:00Z", revealedAt: null, revealState: "pendente", capacity: 250, isTest: false, participants: 32, photos: 418, failedUploads: 0 },
  entitlement: { planCode: "casamento", maxGuests: 250, maxShots: 30, source: "pago" },
  plan: { code: "casamento", name: "Casamento", source: "pago", paidCents: 18900, paidMethod: "pix", orderCode: "ABCD1234" },
  notices: { subscribers: 21, sent: 0, failed: 0, queued: 21 },
  reportsByReason: { naoQueroAparecer: 2, constrangedora: 1, improprio: 0, outro: 0 },
  printOrders: [{ id: "p1", code: "IMP-7K2Q", product: "album", quantity: 1, status: "solicitado" }, { id: "p2", code: "IMP-3F9D", product: "caixa", quantity: 2, status: "em_producao" }],
  audit: [{ at: "2026-11-03T13:14:00Z", action: "admin.set_test_flag", actorRole: "master", actorName: "Marcos", reason: "x", targetType: "event", targetId: "e1" }],
};

describe("M21: admin_event_detail → tela", () => {
  it("plano com valor e método (master), cortesia e grátis", () => {
    expect(planText(base)).toBe("Casamento · R$ 189,00 pago por Pix");
    expect(planText({ ...base, plan: { ...base.plan, paidCents: null, paidMethod: null, source: "cortesia" } })).toBe("Casamento · cortesia");
    expect(planText({ ...base, plan: { code: "gratis", name: "Grátis", source: "gratis", paidCents: null, paidMethod: null, orderCode: null } })).toBe("Grátis");
  });
  it("convidados / capacidade", () => {
    expect(guestsOf(base)).toEqual({ value: "32 de 250", pct: 13 });
    expect(guestsOf({ ...base, entitlement: { ...base.entitlement, maxGuests: null }, event: { ...base.event, capacity: null } }).value).toBe("32 (sem limite)");
  });
  it("revelação: avisos por e-mail só em números", () => {
    const rows = revealRows(base);
    expect(rows.map((r) => r.label)).toEqual(["Prevista", "Situação", "Avisos por e-mail", "Enviados", "Falhas", "Na fila"]);
    expect(rows.find((r) => r.label === "Avisos por e-mail")?.value).toBe("21 inscritos");
    expect(rows.find((r) => r.label === "Situação")?.value).toBe("na fila");
    expect(JSON.stringify(rows)).not.toMatch(/@/);
  });
  it("denúncias por motivo: barras relativas ao maior", () => {
    expect(reasonRows(base)).toEqual([
      { label: "Não quero aparecer", count: 2, pct: 100 }, { label: "Foto constrangedora", count: 1, pct: 50 },
      { label: "Conteúdo impróprio", count: 0, pct: 0 }, { label: "Outro motivo", count: 0, pct: 0 },
    ]);
  });
  it("pedidos de impressão só aparecem com a chave ligada (e para o master)", () => {
    expect(toDetalheProps(base, "Ana Ribeiro", false).prints).toBeNull();
    const on = toDetalheProps(base, "Ana Ribeiro", true).prints!;
    expect(on.map((p) => [p.code, p.product, p.status])).toEqual([["IMP-7K2Q", "Álbum · 1", "solicitado"], ["IMP-3F9D", "Caixa · 2", "em produção"]]);
  });
  it("cabeçalho e linha do tempo", () => {
    const p = toDetalheProps(base, "Ana Ribeiro", false);
    expect(p.title).toBe("Ana & Leo");
    expect(p.caption).toBe("Casamento · Ana Ribeiro · dom, 14 mar 2027 16:30 → seg 02:00");
    expect(p.timeline?.[0]).toMatchObject({ title: "Marcado como evento de teste" });
  });
});
