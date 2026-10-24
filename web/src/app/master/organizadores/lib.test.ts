import { describe, expect, it } from "vitest";
import { aggregateByHost, collectPages, mergeOrganizers, topPlan, type EventLite, type OrgListItem } from "./lib";

const ev = (o: Partial<EventLite>): EventLite => ({ id: "e", hostId: "h1", hostName: "Ana", participants: 0, photos: 0, ...o });
const evs: EventLite[] = [
  ev({ id: "1", participants: 10, photos: 5, planCode: "basico", revealState: "revelada" }),
  ev({ id: "2", participants: 0, photos: 0, planCode: "basico", revealState: "pendente" }),
  ev({ id: "3", participants: 4, photos: 0, planCode: "pro" }),
  ev({ id: "4", hostId: "h2", hostName: "Bia", participants: 1, photos: 1, isTest: true }),
  ev({ id: "5", hostId: "h1", deletedAt: "2026-01-01", participants: 99 }),
];

describe("topPlan", () => {
  it("mais frequente, empate alfabético, nulos ignorados", () => {
    expect(topPlan(["pro", "basico", "pro"])).toBe("pro");
    expect(topPlan(["pro", "basico"])).toBe("basico");
    expect(topPlan([null, undefined])).toBeNull();
  });
});
describe("aggregateByHost", () => {
  it("soma, funil e plano; ignora apagado e teste", () => {
    const r = aggregateByHost(evs, null, { includeTests: false });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ hostId: "h1", name: "Ana", events: 3, participants: 14, photos: 5, topPlan: "basico", revenueCents: null });
    expect(r[0].funnel).toEqual({ created: 3, withParticipant: 2, withPhoto: 1, revealed: 1 });
  });
  it("includeTests traz o anfitrião de teste", () => {
    expect(aggregateByHost(evs, null, { includeTests: true }).map((x) => x.hostId)).toEqual(["h1", "h2"]);
  });
  it("receita só de pedidos pagos, por evento do anfitrião; master sem pedidos = 0", () => {
    const orders = [{ eventId: "1", status: "pago", amountCents: 3000 }, { eventId: "3", status: "pago", amountCents: 500 }, { eventId: "2", status: "pendente", amountCents: 900 }, { eventId: null, status: "pago", amountCents: 9 }];
    expect(aggregateByHost(evs, orders, { includeTests: false })[0].revenueCents).toBe(3500);
    expect(aggregateByHost(evs, [], { includeTests: false })[0].revenueCents).toBe(0);
  });
  it("ignora eventos sem anfitrião", () => {
    expect(aggregateByHost([ev({ hostId: null })], null, { includeTests: true })).toEqual([]);
  });
});
describe("mergeOrganizers", () => {
  const list: OrgListItem[] = [
    { userId: "h1", displayName: "Ana S.", email: "a***@x.com", eventsCount: 5, activeEvents: 1, lastEventAt: "2026-10-01", photos: 50, deletionRequested: true },
    { userId: "h3", displayName: null, email: null, eventsCount: 1, activeEvents: 0, lastEventAt: null, photos: 2, deletionRequested: false },
  ];
  it("usa agregação, esconde sem evento visível quando pedido", () => {
    const aggs = aggregateByHost(evs, null, { includeTests: false });
    const r = mergeOrganizers(list, aggs, { hideEmpty: true });
    expect(r.map((x) => x.hostId)).toEqual(["h1"]);
    expect(r[0]).toMatchObject({ name: "Ana S.", events: 3, photos: 5, deletionRequested: true });
    expect(mergeOrganizers(list, aggs, { hideEmpty: false })).toHaveLength(2);
  });
  it("sem agregação usa a própria lista", () => {
    const r = mergeOrganizers(list, null, { hideEmpty: true });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ events: 5, photos: 50, topPlan: null, revenueCents: null });
  });
});
describe("collectPages", () => {
  const mk = (n: number) => async (off: number) => ({ ok: true as const, total: n, items: Array.from({ length: Math.min(10, n - off) }, (_, i) => off + i) });
  it("junta todas as páginas", async () => {
    const r = await collectPages(mk(25), 10, 1000);
    expect(r.items).toHaveLength(25); expect(r.truncated).toBe(false);
  });
  it("respeita o teto e sinaliza truncamento", async () => {
    const r = await collectPages(mk(100), 10, 30);
    expect(r.items).toHaveLength(30); expect(r.truncated).toBe(true);
  });
  it("erro na primeira página = failed; depois = parcial", async () => {
    expect((await collectPages(async () => ({ ok: false as const }), 10, 100)).failed).toBe(true);
    let n = 0;
    const r = await collectPages(async (off) => (n++ ? { ok: false as const } : { ok: true as const, total: 50, items: Array.from({ length: 10 }, (_, i) => off + i) }), 10, 100);
    expect(r.failed).toBe(false); expect(r.items).toHaveLength(10); expect(r.truncated).toBe(true);
  });
});
