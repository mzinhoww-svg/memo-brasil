import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readEventScoped = vi.fn();
vi.mock("@/features/access/read", () => ({ readEventScoped: (...a: unknown[]) => readEventScoped(...a) }));
vi.mock("./provider", () => ({ useApp: () => app }));
const app = { repos: {}, ready: true, user: { id: "u1" }, now: () => 1 };

import { useEventData } from "./hooks";

const result = { access: "membro", event: { id: "e1" }, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 } };
const visibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("useEventData", () => {
  beforeEach(() => { vi.useFakeTimers(); readEventScoped.mockReset(); readEventScoped.mockResolvedValue(result); visibility("visible"); });
  afterEach(() => vi.useRealTimers());

  it("recarrega em visibilitychange para visível, não para oculto", async () => {
    renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(readEventScoped).toHaveBeenCalledTimes(1);
    await act(async () => { visibility("hidden"); await vi.advanceTimersByTimeAsync(0); });
    expect(readEventScoped).toHaveBeenCalledTimes(1);
    await act(async () => { visibility("visible"); await vi.advanceTimersByTimeAsync(0); });
    expect(readEventScoped).toHaveBeenCalledTimes(2);
  });
  it("recarrega a cada 45 s com a aba visível e pausa com a aba oculta", async () => {
    renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(44_000); });
    expect(readEventScoped).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(readEventScoped).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(readEventScoped).toHaveBeenCalledTimes(2);
  });
  it("falha de rede numa releitura mantém os dados e não derruba a tela", async () => {
    const { result: r } = renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    readEventScoped.mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(r.current.access).toBe("membro");
    expect(r.current.error).toBeUndefined();
  });
  it("falha na primeira leitura aparece como erro tipado, sem ficar carregando para sempre", async () => {
    readEventScoped.mockReset();
    readEventScoped.mockRejectedValue(Object.assign(new Error("x"), { code: "rate-limited" }));
    const { result: r } = renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(r.current.loading).toBe(false);
    expect(r.current.error).toBe("rate-limited");
  });
});
