import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readEventScoped = vi.fn();
vi.mock("@/features/access/read", () => ({ readEventScoped: (...a: unknown[]) => readEventScoped(...a) }));
vi.mock("./provider", () => ({ useApp: () => app }));
const app = { repos: {}, ready: true, user: { id: "u1" } as { id: string }, now: () => 1 };

import { patchEventData, useEventData } from "./hooks";
import { clearAppData, markAppDataStale } from "./data-cache";

const result = { access: "membro", event: { id: "e1" }, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 } };
const visibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("useEventData", () => {
  beforeEach(() => { vi.useFakeTimers(); clearAppData(app.repos); app.user = { id: "u1" }; readEventScoped.mockReset(); readEventScoped.mockResolvedValue(result); visibility("visible"); });
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

  it("outra tela do mesmo evento (convite → câmera) mostra na hora o que já foi lido, sem nova ida nem carregando", async () => {
    const first = renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    first.unmount();
    const second = renderHook(() => useEventData({ code: "ABCD2345" }));
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.access).toBe("membro");
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(readEventScoped).toHaveBeenCalledTimes(1);
  });
  it("cache velho (mais de 15 s ou depois de uma mutação) aparece na hora e é relido por baixo", async () => {
    renderHook(() => useEventData({ code: "ABCD2345" })).unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    markAppDataStale(app.repos);
    const again = renderHook(() => useEventData({ code: "ABCD2345" }));
    expect(again.result.current.loading).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(readEventScoped).toHaveBeenCalledTimes(2);
    again.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(readEventScoped).toHaveBeenCalledTimes(3);
  });
  it("convite em cache não é mostrado de novo sem reler (entrar muda a resposta)", async () => {
    readEventScoped.mockResolvedValueOnce({ ...result, access: "convite", event: undefined, preview: { title: "Festa" } });
    renderHook(() => useEventData({ code: "ABCD2345" })).unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const again = renderHook(() => useEventData({ code: "ABCD2345" }));
    expect(again.result.current.loading).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(again.result.current.access).toBe("membro");
  });
  it("cada pessoa tem a sua entrada: trocar de usuário não mostra o que a outra viu", async () => {
    renderHook(() => useEventData({ code: "ABCD2345" })).unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    app.user = { id: "u2" };
    const other = renderHook(() => useEventData({ code: "ABCD2345" }));
    expect(other.result.current.loading).toBe(true);
  });
  it("patchEventData atualiza na hora quem está mostrando o evento (curtida otimista)", async () => {
    const { result: r } = renderHook(() => useEventData({ code: "ABCD2345" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => patchEventData(app.repos, "e1", (v) => ({ ...v, reactions: [{ eventId: "e1", photoId: "p1", authorId: "u1", kind: "amei" }] })));
    expect(r.current.reactions).toHaveLength(1);
    expect(readEventScoped).toHaveBeenCalledTimes(1);
  });
});
