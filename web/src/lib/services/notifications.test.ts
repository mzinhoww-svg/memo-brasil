import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannedNotification } from "@/domain/notifications";
import { createLocalScheduler } from "./notifications";

const n = (at: number, kind: PlannedNotification["kind"] = "encerrou"): PlannedNotification => ({ kind, at, title: "t", body: "b" });

describe("agendador local", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1000 }));
  afterEach(() => vi.useRealTimers());

  it("dispara no horário e cancela por evento", () => {
    const show = vi.fn();
    const s = createLocalScheduler(show);
    s.schedule("e1", [n(2000), n(5000)]);
    vi.advanceTimersByTime(1500);
    expect(show).toHaveBeenCalledTimes(1);
    s.cancel("e1");
    vi.advanceTimersByTime(10_000);
    expect(show).toHaveBeenCalledTimes(1);
  });
  it("reagendar substitui a agenda anterior (sem duplicar)", () => {
    const show = vi.fn();
    const s = createLocalScheduler(show);
    s.schedule("e1", [n(2000)]);
    s.schedule("e1", [n(2000)]);
    vi.advanceTimersByTime(2000);
    expect(show).toHaveBeenCalledTimes(1);
  });
  it("ignora horários além do limite do setTimeout", () => {
    const show = vi.fn();
    createLocalScheduler(show).schedule("e1", [n(1000 + 2 ** 31 + 10)]);
    vi.advanceTimersByTime(2 ** 31);
    expect(show).not.toHaveBeenCalled();
  });
});
