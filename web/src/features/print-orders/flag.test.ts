// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const mode = vi.hoisted(() => ({ value: "supabase" as "supabase" | "local" }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => mode.value }));
import { fetchPrintedAlbumEnabled, usePrintedAlbumEnabled } from "./flag";

beforeEach(() => { rpc.mockReset(); mode.value = "supabase"; });
afterEach(() => vi.restoreAllMocks());

describe("chave printed_album vista pelo anfitrião", () => {
  it("pergunta ao servidor (printed_album_enabled) e respeita a resposta", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await fetchPrintedAlbumEnabled()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("printed_album_enabled");
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await fetchPrintedAlbumEnabled()).toBe(false);
  });
  it("erro ou resposta estranha esconde (na dúvida, desligado)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await fetchPrintedAlbumEnabled()).toBe(false);
    rpc.mockResolvedValue({ data: "true", error: null });
    expect(await fetchPrintedAlbumEnabled()).toBe(false);
  });
  it("o hook começa indefinido, depois mostra o valor; falha de rede = desligado", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const a = renderHook(() => usePrintedAlbumEnabled());
    expect(a.result.current).toBeUndefined();
    await waitFor(() => expect(a.result.current).toBe(true));
    rpc.mockRejectedValue(new Error("rede"));
    const b = renderHook(() => usePrintedAlbumEnabled());
    await waitFor(() => expect(b.result.current).toBe(false));
  });
  it("modo local (demonstração, sem servidor): disponível, sem consultar", () => {
    mode.value = "local";
    const { result } = renderHook(() => usePrintedAlbumEnabled());
    expect(result.current).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
