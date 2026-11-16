import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseRepositories } from "@/repositories/supabase";
import { EVENT, HOST, fakeSupabase, measure } from "@/perf/fake-supabase";
import { loadMyEvents } from "./my-events";

const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("Meus eventos no servidor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("listMine: as duas consultas em paralelo (1 ida em série) e sem repetir o evento criado e participado", async () => {
    const { sb, calls } = fakeSupabase({ me: HOST });
    const m = await measure(adv, () => createSupabaseRepositories(sb).events.listMine!(HOST));
    expect(m.serial).toBe(1);
    expect(calls.length).toBe(2);
    expect(m.value.map((e) => e.id)).toEqual([EVENT]);
  });

  it("loadMyEvents não confere participação de novo quando o servidor já filtrou", async () => {
    const { sb, calls } = fakeSupabase({ me: "55555555-5555-4555-8555-555555555555" });
    const m = await measure(adv, () => loadMyEvents(createSupabaseRepositories(sb), "55555555-5555-4555-8555-555555555555", 10_000));
    expect(m.value.joined.map((e) => e.id)).toEqual([EVENT]);
    expect(calls.filter((c) => c.what.includes("maybeSingle"))).toEqual([]);
    expect(m.serial).toBe(1);
  });
});
