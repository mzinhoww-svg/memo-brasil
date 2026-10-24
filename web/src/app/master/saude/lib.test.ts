import { describe, expect, it } from "vitest";
import { duration, failStreak, historyFromLegacy, jobView, toHistory } from "./lib";

const run = (startedAt: string, status: string, durationMs: number | null = 100) => ({ startedAt, status, durationMs });

describe("failStreak", () => {
  it("conta falhas seguidas a partir da mais recente, em qualquer ordem de entrada", () => {
    expect(failStreak([run("2026-10-23T01:00Z", "failed"), run("2026-10-23T03:00Z", "failed"), run("2026-10-23T02:00Z", "failed"), run("2026-10-22T00:00Z", "succeeded")])).toBe(3);
    expect(failStreak([run("2026-10-23T03:00Z", "succeeded"), run("2026-10-23T02:00Z", "failed")])).toBe(0);
    expect(failStreak([])).toBe(0);
  });
});

describe("jobView", () => {
  const now = new Date("2026-10-23T12:00:30Z");
  it("cron legível, próxima execução, última corrida e quadrados antiga→recente", () => {
    const v = jobView({ name: "mm-reveal", schedule: "*/5 * * * *", active: true, runs: [run("2026-10-23T12:00Z", "succeeded", 850), run("2026-10-23T11:55Z", "failed")], consecutiveFailures: 0 }, now);
    expect(v.readable).toBe("a cada 5 min");
    expect(v.next?.toISOString()).toBe("2026-10-23T12:05:00.000Z");
    expect(v.last?.durationMs).toBe(850);
    expect(v.squares.map((s) => s.tone)).toEqual(["crit", "ok"]);
    expect(v.alert).toBe(false);
  });
  it("alerta com 2 falhas seguidas", () => {
    const v = jobView({ name: "x", schedule: "0 3 * * *", active: true, runs: [run("2026-10-23T03:00Z", "failed"), run("2026-10-22T03:00Z", "failed")], consecutiveFailures: 0 }, now);
    expect(v.streak).toBe(2);
    expect(v.alert).toBe(true);
  });
  it("rotina inativa não alerta nem tem próxima execução", () => {
    const v = jobView({ name: "x", schedule: "41 4 * * *", active: false, runs: [], consecutiveFailures: 5 }, now);
    expect(v.alert).toBe(false);
    expect(v.next).toBeNull();
    expect(v.lastTone).toBe("dim");
  });
  it("mostra no máximo 24 corridas", () => {
    const runs = Array.from({ length: 30 }, (_, i) => run(new Date(Date.UTC(2026, 9, 23, 0, i)).toISOString(), "succeeded"));
    expect(jobView({ name: "x", schedule: "* * * * *", active: true, runs, consecutiveFailures: 0 }, now).squares).toHaveLength(24);
  });
});

describe("normalização", () => {
  it("toHistory calcula a sequência quando a RPC não informa", () => {
    const h = toHistory({ cronAvailable: true, jobs: [{ name: "a", schedule: "* * * * *", active: true, runs: [run("2026-10-23T01:00Z", "failed")] }] });
    expect(h.jobs[0].consecutiveFailures).toBe(1);
  });
  it("fallback de admin_health vira uma corrida só, sem duração", () => {
    const h = historyFromLegacy({ cronAvailable: true, jobs: [{ name: "a", schedule: "0 * * * *", active: true, lastRun: { startedAt: "2026-10-23T01:00Z", status: "succeeded" } }, { name: "b", schedule: "0 * * * *", active: true, lastRun: null }] });
    expect(h.jobs[0].runs).toEqual([{ startedAt: "2026-10-23T01:00Z", durationMs: null, status: "succeeded" }]);
    expect(h.jobs[1].runs).toEqual([]);
  });
});

describe("duration", () => {
  it("formata ms, s e min", () => {
    expect(duration(850)).toBe("850 ms");
    expect(duration(12_400)).toBe("12 s");
    expect(duration(125_000)).toBe("2 min 5 s");
    expect(duration(null)).toBe("—");
  });
});
