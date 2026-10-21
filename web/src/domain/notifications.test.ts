import { describe, expect, it } from "vitest";
import type { MemoEvent } from "./event";
import { notificationPlan } from "./notifications";

const H = 3_600_000;
const ev = (o: Partial<MemoEvent> = {}): MemoEvent => ({
  id: "e", code: "AAAAAAAA", title: "Emy e Igor", category: "casamento", hostId: "h", hostName: "Emy", startAt: 0, durationHours: 6,
  cameraStyle: "original", revealEnabled: true, revealAt: 6 * H, revealAnchor: "fim", revealOffsetDays: 0, revealedAt: null, version: 1, timezone: "UTC", revealStatus: "pendente", capacity: 50, shotsPerPerson: 24, everyoneSeesAll: true,
  reactionsEnabled: true, palette: "salvia", eventFont: "birthstone", moments: [], tables: 0, createdAt: 0, ...o,
});

describe("agenda de avisos (REA E-18)", () => {
  it("evento recém-aberto: fim −1 dia não existe (já passou), mas −1 h, −10 min, fim e revelação sim", () => {
    const kinds = notificationPlan(ev(), 0).map((n) => n.kind);
    expect(kinds).toEqual(["fecha-em-breve", "ultima-chamada", "revela-em-breve", "encerrou", "revelou"]);
  });
  it("ordena por horário e descarta o que já passou", () => {
    const plan = notificationPlan(ev(), 5.5 * H);
    expect(plan.map((n) => n.at)).toEqual([...plan.map((n) => n.at)].sort((a, b) => a - b));
    expect(plan.every((n) => n.at > 5.5 * H)).toBe(true);
    expect(plan.map((n) => n.kind)).toContain("ultima-chamada");
  });
  it("revelação desligada não agenda aviso de revelação", () => {
    expect(notificationPlan(ev({ revealEnabled: false, revealAt: null }), 0).some((n) => n.kind === "revelou" || n.kind === "revela-em-breve")).toBe(false);
  });
  it("revelação com atraso cai em fim + N dias", () => {
    const plan = notificationPlan(ev({ revealAt: 6 * H + 2 * 24 * H }), 0);
    expect(plan.find((n) => n.kind === "revelou")!.at).toBe(6 * H + 2 * 24 * H);
  });
  it("evento encerrado não agenda nada", () => {
    expect(notificationPlan(ev(), 100 * H)).toEqual([]);
  });
});
