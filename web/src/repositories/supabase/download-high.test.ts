import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryRepositories } from "../memory";
import { createSupabaseRepositories } from "./index";

/** Cliente de mentira: qualquer encadeamento devolve a si mesmo e, ao ser aguardado, entrega `result`. */
function chain(result: unknown, spy?: (patch: unknown) => void) {
  const c: Record<string, unknown> = {};
  for (const k of ["select", "eq", "order", "range", "single", "maybeSingle"]) c[k] = () => c;
  c.update = (p: unknown) => { spy?.(p); return c; };
  c.insert = (p: unknown) => { spy?.(p); return c; };
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
  return c;
}

const base = async () => {
  const repos = createMemoryRepositories();
  const host = { id: "u1", name: "Ana" };
  const { createEvent } = await import("@/features/events/service");
  const r = await createEvent(repos, host as never, { title: "Festa", category: "festa", durationHours: 3, reveal: { enabled: false } as never, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone" }, Date.now());
  if (!r.ok) throw new Error("seed");
  return r.event;
};

describe("events.guest_download_high no servidor", () => {
  it("grava o campo no UPDATE e lê de volta; coluna ausente conta como permitido", async () => {
    const e = await base();
    const sent: unknown[] = [];
    const row = (v: unknown) => ({ id: e.id, code: "ABC", title: "Festa", category: "festa", host_id: "u1", host_name: "Ana", start_at: new Date(e.startAt).toISOString(), duration_hours: 3, camera_style: "original", reveal_enabled: false, reveal_anchor: "fim", reveal_offset_days: 0, timezone: "UTC", reveal_status: "desativada", version: 2, capacity: 10, shots_per_person: 5, everyone_sees_all: true, reactions_enabled: true, palette: "salvia", event_font: "birthstone", moments: [], tables: 0, created_at: new Date().toISOString(), guest_download_high: v });
    const from = vi.fn((t: string) => (t === "event_themes" ? chain({ data: null, error: null }) : chain({ data: [row(false)], error: null }, (p) => sent.push(p))));
    const repos = createSupabaseRepositories({ from, rpc: vi.fn() } as unknown as SupabaseClient);
    const saved = await repos.events.save({ ...e, guestDownloadHigh: false }, { expectedVersion: e.version });
    expect(sent[0]).toMatchObject({ guest_download_high: false });
    expect(saved.guestDownloadHigh).toBe(false);
    const legacy = createSupabaseRepositories({ from: vi.fn((t: string) => chain({ data: t === "event_themes" ? null : [{ ...row(undefined), guest_download_high: undefined }], error: null })), rpc: vi.fn() } as unknown as SupabaseClient);
    expect((await legacy.events.save(e, { expectedVersion: e.version })).guestDownloadHigh).toBe(true);
  });
});
