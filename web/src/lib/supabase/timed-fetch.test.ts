import { afterEach, describe, expect, it, vi } from "vitest";
import { REST_TIMEOUT_MS, STORAGE_TIMEOUT_MS, timedFetch, timeoutFor } from "./timed-fetch";
import { toRepositoryError } from "@/repositories/supabase";

afterEach(() => { vi.useRealTimers(); });

/** fetch falso que só responde quando o sinal aborta (como uma rede que travou). */
const hanging = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_res, rej) => {
  init?.signal?.addEventListener("abort", () => rej(init.signal!.reason));
}));

describe("tempo limite das chamadas ao Supabase", () => {
  it("15 s para RPC/REST/Auth e 60 s para o Storage", () => {
    expect(timeoutFor("https://x.supabase.co/rest/v1/rpc/begin_photo")).toBe(REST_TIMEOUT_MS);
    expect(timeoutFor("https://x.supabase.co/auth/v1/token")).toBe(REST_TIMEOUT_MS);
    expect(timeoutFor(new URL("https://x.supabase.co/storage/v1/object/event-photos/a/b"))).toBe(STORAGE_TIMEOUT_MS);
    expect(REST_TIMEOUT_MS).toBe(15_000);
    expect(STORAGE_TIMEOUT_MS).toBe(60_000);
  });
  it("aborta a requisição presa e a falha vira erro de rede (unavailable)", async () => {
    vi.useFakeTimers();
    const f = timedFetch(hanging as unknown as typeof fetch);
    const p = f("https://x.supabase.co/rest/v1/rpc/finalize_photo", { method: "POST" });
    const caught = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REST_TIMEOUT_MS + 1);
    const err = await caught;
    expect(err).toBeInstanceOf(TypeError);
    expect(toRepositoryError({ message: String(err) }).code).toBe("unavailable");
  });
  it("respeita o cancelamento de quem chamou e não mexe em respostas rápidas", async () => {
    const ok = timedFetch(async () => new Response("ok"));
    expect(await (await ok("https://x.supabase.co/rest/v1/events")).text()).toBe("ok");
    const ctrl = new AbortController();
    const p = timedFetch(hanging as unknown as typeof fetch)("https://x.supabase.co/rest/v1/events", { signal: ctrl.signal });
    ctrl.abort(new DOMException("parou", "AbortError"));
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
