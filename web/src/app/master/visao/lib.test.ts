import { describe, expect, it } from "vitest";
import { toEventRow } from "../eventos/lib";
import { attention, chartData, overviewFromLegacy, readinessItems, toOverview } from "./lib";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const CAPS = [10, 30, 100, 250, 500];

describe("toOverview", () => {
  it("lê kpis e mantém receita nula para quem não é master", () => {
    const o = toOverview({ days: 7, kpis: { activeEvents: { value: 3, previous: 2, spark: [1, 2, 3] }, revenueCents: { value: null, previous: null, spark: [] } } });
    expect(o.days).toBe(7);
    expect(o.kpis.activeEvents).toEqual({ value: 3, previous: 2, spark: [1, 2, 3] });
    expect(o.kpis.revenueCents.value).toBeNull();
    expect(o.kpis.photos).toEqual({ value: null, previous: null, spark: [] });
    expect(o.jobs).toEqual([]);
  });
});

describe("overviewFromLegacy", () => {
  it("usa os números do console atual, sem anterior nem receita", () => {
    const o = overviewFromLegacy({ events: { active: 4 }, participants: { joined: 12 }, photos: { uploaded: 80 } }, 30);
    expect(o.kpis.activeEvents.value).toBe(4);
    expect(o.kpis.participants.value).toBe(12);
    expect(o.kpis.photos.value).toBe(80);
    expect(o.kpis.photos.previous).toBeNull();
    expect(o.kpis.revenueCents.value).toBeNull();
    expect(o.funnel).toBeNull();
    expect(o.readiness).toBeNull();
  });
});

describe("chartData", () => {
  it("rotula dd/mm e mapeia barras e linha", () => {
    expect(chartData([{ day: "2026-10-05", photos: 4, joins: 2, eventsCreated: 1 }])).toEqual([{ label: "05/10", a: 4, b: 2, line: 1 }]);
  });
});

describe("readinessItems", () => {
  it("seis itens; pagamentos só ok em produção; webhook exige último evento", () => {
    const items = readinessItems({ companyCnpj: true, companyLegalName: true, supportEmail: true, supportPhone: false, paymentsEnv: "sandbox", lastWebhookAt: null });
    expect(items).toHaveLength(6);
    expect(items.filter((i) => !i.ok).map((i) => i.key)).toEqual(["telefone", "pagamentos", "webhook"]);
  });
  it("tudo ok quando completo", () => {
    expect(readinessItems({ companyCnpj: true, companyLegalName: true, supportEmail: true, supportPhone: true, paymentsEnv: "production", lastWebhookAt: "2026-10-01T00:00:00Z" }).every((i) => i.ok)).toBe(true);
  });
  it("sem prontidão (modo degradado) não há itens", () => {
    expect(readinessItems(null)).toEqual([]);
  });
});

describe("attention", () => {
  const ev = (o: Record<string, unknown>) => toEventRow({ id: String(o.id), title: "E", hostName: "Ana", hostId: "h", status: "ativo", revealState: "pendente", revealAt: "2026-12-01T00:00:00Z", participants: 5, capacity: 30, ...o });
  it("ordena por risco e descarta eventos sem sinal", () => {
    const rows = [
      ev({ id: "ok" }),
      ev({ id: "fora", capacity: 42 }),
      ev({ id: "atrasada", revealState: "atrasada", revealAt: "2026-10-20T00:00:00Z" }),
      ev({ id: "vazio", participants: 0 }),
      ev({ id: "semhost", hostName: "", hostId: null, revealState: "desativada", revealAt: null, participants: 0 }),
    ];
    expect(attention(rows, NOW, CAPS).map((x) => x.row.id)).toEqual(["semhost", "atrasada", "vazio", "fora"]);
  });
  it("ignora excluídos e respeita o limite", () => {
    const rows = [ev({ id: "a", participants: 0, deletedAt: "2026-10-01" }), ev({ id: "b", participants: 0 }), ev({ id: "c", participants: 0 })];
    expect(attention(rows, NOW, CAPS, 1).map((x) => x.row.id)).toEqual(["b"]);
  });
});
