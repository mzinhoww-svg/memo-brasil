import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannedNotification } from "@/domain/notifications";
import { createLocalScheduler } from "./notifications";

const n = (at: number, kind: PlannedNotification["kind"] = "encerrou"): PlannedNotification => ({ kind, at, title: "t", body: "b" });

describe("agendador local", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1000 }));
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
  it("registra inscrição com permissão e exibição só no evento nativo show", () => {
    const note = new EventTarget();
    vi.stubGlobal("Notification", { permission: "granted" });
    const receipts = { enroll: vi.fn(), shown: vi.fn() };
    createLocalScheduler(() => note as Notification, receipts).schedule("e1", [n(2000, "revelou")]);
    expect(receipts.enroll).toHaveBeenCalledWith("e1");
    expect(receipts.shown).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(receipts.shown).not.toHaveBeenCalled();
    note.dispatchEvent(new Event("show"));
    note.dispatchEvent(new Event("show"));
    expect(receipts.shown).toHaveBeenCalledExactlyOnceWith("e1");
  });
  it.each(["default", "denied"])("não registra inscrição sem permissão: %s", permission => {
    vi.stubGlobal("Notification", { permission });
    const receipts = { enroll: vi.fn(), shown: vi.fn() };
    createLocalScheduler(() => undefined, receipts).schedule("e1", [n(2000, "revelou")]);
    vi.advanceTimersByTime(1000);
    expect(receipts.enroll).not.toHaveBeenCalled();
    expect(receipts.shown).not.toHaveBeenCalled();
  });
  it("não confunde agendamento nem aviso de encerramento com entrega de revelação", () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    const receipts = { enroll: vi.fn(), shown: vi.fn() };
    createLocalScheduler(() => undefined, receipts).schedule("e1", [n(2000)]);
    vi.advanceTimersByTime(1000);
    expect(receipts.enroll).not.toHaveBeenCalled();
    expect(receipts.shown).not.toHaveBeenCalled();
  });
  it("falha na observação não impede o aviso local", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    const show = vi.fn();
    const receipts = { enroll: vi.fn().mockRejectedValue(new Error("offline")), shown: vi.fn() };
    createLocalScheduler(show, receipts).schedule("e1", [n(2000, "revelou")]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(show).toHaveBeenCalledOnce();
    expect(receipts.shown).not.toHaveBeenCalled();
  });
});
