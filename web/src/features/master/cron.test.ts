import { describe, expect, it } from "vitest";
import { humanCron, nextRun } from "./cron";

describe("humanCron", () => {
  it.each([
    ["* * * * *", "a cada minuto"],
    ["*/1 * * * *", "a cada minuto"],
    ["*/10 * * * *", "a cada 10 min"],
    ["0 * * * *", "de hora em hora"],
    ["0 3 * * *", "diariamente às 03:00 (UTC)"],
    ["30 14 * * *", "diariamente às 14:30 (UTC)"],
    ["0 */6 * * *", "a cada 6 h"],
    ["0 3 * * 1", "0 3 * * 1"],
    ["lixo", "lixo"],
    ["61 * * * *", "61 * * * *"],
  ])("%s", (e, out) => expect(humanCron(e)).toBe(out));
});
describe("nextRun", () => {
  const from = new Date("2026-10-23T12:34:56Z");
  it("a cada minuto", () => expect(nextRun("* * * * *", from)?.toISOString()).toBe("2026-10-23T12:35:00.000Z"));
  it("a cada 10 min", () => expect(nextRun("*/10 * * * *", from)?.toISOString()).toBe("2026-10-23T12:40:00.000Z"));
  it("de hora em hora", () => expect(nextRun("0 * * * *", from)?.toISOString()).toBe("2026-10-23T13:00:00.000Z"));
  it("diário já passou hoje: amanhã", () => expect(nextRun("0 3 * * *", from)?.toISOString()).toBe("2026-10-24T03:00:00.000Z"));
  it("diário ainda hoje", () => expect(nextRun("0 18 * * *", from)?.toISOString()).toBe("2026-10-23T18:00:00.000Z"));
  it("estritamente depois de from", () => expect(nextRun("*/10 * * * *", new Date("2026-10-23T12:40:00Z"))?.toISOString()).toBe("2026-10-23T12:50:00.000Z"));
  it("não interpretável: null", () => expect(nextRun("0 3 * * 1", from)).toBeNull());
});
