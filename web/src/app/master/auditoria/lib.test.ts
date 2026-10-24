import { describe, expect, it } from "vitest";
import { actionCategory, categoryOf, dayLabel, groupByDay, isSensitive, legacyIsPartial, roleLabel, targetEvent, targetText } from "./lib";

const EV = "11111111-2222-3333-4444-555555555555";

describe("categorias", () => {
  it("aceita só as cinco categorias", () => {
    expect(categoryOf("revelacao")).toBe("revelacao");
    expect(categoryOf("x")).toBeNull();
    expect(categoryOf(["pagamento"])).toBe("pagamento");
  });
  it("classifica ações pelo mesmo prefixo do banco", () => {
    expect(actionCategory("invitation.created")).toBe("participante");
    expect(actionCategory("account.deleted")).toBe("consentimento");
    expect(actionCategory("reveal.released")).toBe("revelacao");
    expect(actionCategory("platform_settings.update")).toBe("admin");
    expect(actionCategory("photo.access")).toBe("admin");
    expect(actionCategory("apply.code")).toBe("pagamento");
    expect(actionCategory("photo.uploaded")).toBeNull();
  });
  it("sabe quando o filtro antigo é parcial", () => {
    expect(legacyIsPartial("revelacao")).toBe(false);
    expect(legacyIsPartial("participante")).toBe(true);
  });
});

describe("sensível", () => {
  it("motivo ou ação administrativa", () => {
    expect(isSensitive("participant.joined", null)).toBe(false);
    expect(isSensitive("participant.joined", "pedido do titular")).toBe(true);
    expect(isSensitive("admin.reveal_now", null)).toBe(true);
    expect(isSensitive("payment.refund_requested", null)).toBe(true);
    expect(isSensitive("payment.paid", null)).toBe(false);
  });
});

describe("papéis em português", () => {
  it("traduz os valores gravados", () => {
    expect(["sistema", "organizador", "convidado", "master", "support", "auditor"].map(roleLabel)).toEqual(["Sistema", "Organizador", "Convidado", "Master", "Suporte", "Auditor"]);
    expect(roleLabel(null)).toBe("—");
    expect(roleLabel("novo")).toBe("novo");
  });
});

describe("agrupamento por dia local", () => {
  it("agrupa em ordem, no fuso de Cuiabá", () => {
    const g = groupByDay([{ at: "2026-10-23T15:00:00Z" }, { at: "2026-10-23T05:00:00Z" }, { at: "2026-10-23T03:00:00Z" }, { at: "2026-10-21T12:00:00Z" }]);
    expect(g.map((x) => [x.day, x.items.length])).toEqual([["2026-10-23", 2], ["2026-10-22", 1], ["2026-10-21", 1]]);
  });
  it("rótulo do dia", () => expect(dayLabel("2026-10-23")).toBe("sexta, 23/10/2026"));
});

describe("alvo", () => {
  it("evento-alvo pelo tipo ou pelo evento da linha", () => {
    expect(targetEvent({ targetType: "event", targetId: EV, eventId: null })).toBe(EV);
    expect(targetEvent({ targetType: "platform_settings", targetId: "company_cnpj", eventId: EV })).toBe(EV);
    expect(targetEvent({ targetType: "platform_settings", targetId: "company_cnpj", eventId: null })).toBeNull();
    expect(targetEvent({ targetType: "event", targetId: "nao-uuid", eventId: null })).toBeNull();
  });
  it("texto do alvo prefere o título e encurta ids", () => {
    expect(targetText({ targetType: "event", targetId: EV, eventTitle: "Casamento" })).toBe("Casamento");
    expect(targetText({ targetType: "event", targetId: EV, eventTitle: null })).toBe("event:11111111");
    expect(targetText({ targetType: null, targetId: null })).toBe("—");
  });
});
