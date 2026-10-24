import { describe, expect, it } from "vitest";
import { cohortEvent, cohortRange, cohorts, cohortWeeks, cumulative, fromLegacy, fromOverview, lastWeeks, localDay, metricOf, shortDay, splitPeriods, total, weekLabel, weekStart, type DayPoint } from "./lib";

const pt = (day: string, photos = 0, joins = 0, eventsCreated = 0): DayPoint => ({ day, photos, joins, eventsCreated });

describe("normalização das séries", () => {
  it("lê admin_overview", () => {
    expect(fromOverview([{ day: "2026-10-01", photos: 3, joins: 2, eventsCreated: 1 }])).toEqual([pt("2026-10-01", 3, 2, 1)]);
  });
  it("lê admin_dashboard_metrics (nomes antigos)", () => {
    expect(fromLegacy([{ day: "2026-10-01", photosUploaded: 5, participantsJoined: 4, eventsCreated: 2, uploadsFailed: 9 }])).toEqual([pt("2026-10-01", 5, 4, 2)]);
  });
  it("formato inesperado vira lista vazia ou zero", () => {
    expect(fromOverview(null)).toEqual([]);
    expect(fromLegacy([{ day: "2026-10-01", photosUploaded: "x" }])).toEqual([pt("2026-10-01")]);
  });
});

describe("splitPeriods", () => {
  it("separa os últimos N do período anterior de mesmo tamanho, em ordem", () => {
    const s = [pt("2026-10-04", 4), pt("2026-10-01", 1), pt("2026-10-03", 3), pt("2026-10-02", 2)];
    const { current, previous } = splitPeriods(s, 2);
    expect(current.map((d) => d.photos)).toEqual([3, 4]);
    expect(previous.map((d) => d.photos)).toEqual([1, 2]);
  });
  it("série antiga com 2N+1 dias descarta o excedente mais antigo", () => {
    const s = [pt("2026-10-01", 9), pt("2026-10-02", 1), pt("2026-10-03", 2), pt("2026-10-04", 3), pt("2026-10-05", 4)];
    const { current, previous } = splitPeriods(s, 2);
    expect(current.map((d) => d.photos)).toEqual([3, 4]);
    expect(previous.map((d) => d.photos)).toEqual([1, 2]);
  });
  it("histórico curto completa o anterior com zeros", () => {
    const { previous } = splitPeriods([pt("2026-10-01", 1), pt("2026-10-02", 2), pt("2026-10-03", 3)], 2);
    expect(previous.map((d) => d.photos)).toEqual([0, 1]);
  });
});

describe("totais, acumulado e métrica", () => {
  it("soma por métrica", () => expect(total([pt("a", 1, 2), pt("b", 3, 4)], "joins")).toBe(6));
  it("acumula", () => expect(cumulative([1, 0, 2, 3])).toEqual([1, 1, 3, 6]));
  it("métrica desconhecida cai em fotos", () => {
    expect(metricOf("joins")).toBe("joins");
    expect(metricOf("x")).toBe("photos");
    expect(metricOf(undefined)).toBe("photos");
  });
  it("dia curto", () => expect(shortDay("2026-10-23")).toBe("23/10"));
});

describe("coortes semanais", () => {
  it("semana começa na segunda", () => {
    expect(weekStart("2026-10-23")).toBe("2026-10-19"); // sexta
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // segunda
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // domingo
  });
  it("dia local usa Cuiabá (UTC-4)", () => {
    expect(localDay("2026-10-20T02:00:00Z")).toBe("2026-10-19");
    expect(localDay("2026-10-20T05:00:00Z")).toBe("2026-10-20");
  });
  it("lista as últimas semanas, mais antiga primeiro", () => {
    expect(lastWeeks(new Date("2026-10-23T15:00:00Z"), 3)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
  });
  it("quantidade de semanas pelo período", () => {
    expect([cohortWeeks(7), cohortWeeks(30), cohortWeeks(90)]).toEqual([2, 5, 13]);
  });
  it("conta criados, com participante e com foto por semana de criação", () => {
    const weeks = ["2026-10-12", "2026-10-19"];
    const ev = [
      { createdAt: "2026-10-13T12:00:00Z", participants: 0, photos: 0 },
      { createdAt: "2026-10-14T12:00:00Z", participants: 3, photos: 0 },
      { createdAt: "2026-10-20T03:00:00Z", participants: 2, photos: 5 }, // 19/10 local
      { createdAt: "2026-10-01T12:00:00Z", participants: 9, photos: 9 }, // fora das semanas
      { createdAt: "", participants: 1, photos: 1 },
    ];
    expect(cohorts(ev, weeks)).toEqual([
      { week: "2026-10-12", created: 2, withParticipant: 1, withPhoto: 0 },
      { week: "2026-10-19", created: 1, withParticipant: 1, withPhoto: 1 },
    ]);
  });
  it("normaliza item de lista de eventos", () => {
    expect(cohortEvent({ createdAt: "2026-10-01T00:00:00Z", participants: "2", photos: null })).toEqual({ createdAt: "2026-10-01T00:00:00Z", participants: 2, photos: 0 });
  });
  it("rótulo da semana", () => expect(weekLabel("2026-10-19")).toBe("19/10 a 25/10"));
  it("intervalo de coortes: semanas e meia-noite local da mais antiga", () => {
    const r = cohortRange(7, Date.parse("2026-10-23T15:00:00Z"));
    expect(r.weeks).toEqual(["2026-10-12", "2026-10-19"]);
    expect(new Date(r.sinceMs).toISOString()).toBe("2026-10-12T04:00:00.000Z");
  });
});
