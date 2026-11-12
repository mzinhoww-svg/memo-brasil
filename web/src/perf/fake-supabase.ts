/**
 * Cliente Supabase falso para medir idas à rede sem servidor: cada consulta, RPC, chamada de Storage ou `auth.getUser()`
 * conta como uma ida e só responde depois de `LATENCY` ms (relógio falso do vitest). `getSession()` é local (sem ida),
 * como no SDK real enquanto o token não venceu. A profundidade (idas em série) sai do relógio: tempo total / LATENCY.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const LATENCY = 100;
export const HOST = "11111111-1111-4111-8111-111111111111";
export const GUEST = "22222222-2222-4222-8222-222222222222";
export const EVENT = "33333333-3333-4333-8333-333333333333";
export const CODE = "ABCD2345";
const photoId = (i: number) => `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`;

export interface Call { kind: "db" | "rpc" | "storage" | "auth"; what: string }

const eventRow = () => ({
  id: EVENT, code: CODE, title: "Festa", category: "casamento", host_id: HOST, host_name: "Ana", start_at: new Date(0).toISOString(), duration_hours: 6,
  ended_at: null, camera_style: "original", film_look: "filme35", reveal_enabled: false, reveal_at: null, reveal_anchor: "fim", reveal_offset_days: 0,
  timezone: "UTC", reveal_status: "desativada", revealed_at: null, version: 1, capacity: 50, shots_per_person: 24, everyone_sees_all: true,
  guest_download_high: true, reactions_enabled: true, palette: "salvia", event_font: "birthstone", place: null, moments: [], tables: 0, notice: null,
  created_at: new Date(0).toISOString(), event_themes: null,
});
const photoRow = (i: number) => ({
  id: photoId(i), event_id: EVENT, author_id: GUEST, author_name: "Bia", created_at: new Date(1000 + i).toISOString(), moment: "Agora", caption: null,
  table_label: null, status: "visivel", reports: 0, highlighted: false, version: 1, upload_status: "pronta", captured_at: null, storage_path: `${EVENT}/${photoId(i)}`,
});
const participantRow = (u: string) => ({ event_id: EVENT, user_id: u, name: u === HOST ? "Ana" : "Bia", joined_at: new Date(0).toISOString(), blocked_at: null, table_label: null });

export function fakeSupabase(opts: { photos?: number; me?: string; anonymous?: boolean } = {}) {
  const n = opts.photos ?? 20;
  const me = opts.me ?? GUEST;
  const calls: Call[] = [];
  const wait = <T,>(c: Call, v: T): Promise<T> => {
    calls.push(c);
    return new Promise((r) => setTimeout(() => r(v), LATENCY));
  };
  let signed = 0;
  const sign = (path: string) => (path.endsWith(".thumb") ? { path, error: "Either the object does not exist or you do not have access to it", signedUrl: null } : { path, error: null, signedUrl: `https://sb.test/sign/${path}?token=${++signed}` });

  const resolve = (table: string, ops: [string, unknown[]][]): { data: unknown; error: null; count?: number } => {
    const has = (m: string) => ops.some(([k]) => k === m);
    const sel = String(ops.find(([k]) => k === "select")?.[1][0] ?? "*");
    const single = has("maybeSingle") || has("single");
    const head = ops.some(([k, a]) => k === "select" && (a[1] as { head?: boolean } | undefined)?.head);
    if (table === "events") return { data: single ? eventRow() : [eventRow()], error: null };
    if (table === "participants") {
      if (head) return { data: null, error: null, count: 2 };
      if (sel.includes("events(")) return { data: [{ event_id: EVENT, events: eventRow() }], error: null };
      if (sel === "event_id") return { data: [{ event_id: EVENT }], error: null };
      return single ? { data: participantRow(me), error: null } : { data: [participantRow(HOST), participantRow(GUEST)], error: null };
    }
    if (table === "photos") {
      if (head) return { data: null, error: null, count: n };
      if (single) return { data: { ...photoRow(0), mime: "image/jpeg" }, error: null };
      return { data: Array.from({ length: n }, (_, i) => photoRow(i)), error: null };
    }
    if (table === "reactions") return { data: [], error: null };
    if (table === "profiles") return { data: { display_name: "Bia", created_at: new Date(0).toISOString() }, error: null };
    return { data: single ? null : [], error: null };
  };

  const builder = (table: string) => {
    const ops: [string, unknown[]][] = [];
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "or", "in", "order", "range", "maybeSingle", "single", "update", "insert", "upsert", "delete", "limit"]) {
      b[m] = (...a: unknown[]) => { ops.push([m, a]); return b; };
    }
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => wait({ kind: "db", what: `${table}:${ops.map(([k]) => k).join(".")}` }, null).then(() => resolve(table, ops)).then(ok, ko);
    return b;
  };

  const user = { id: me, is_anonymous: opts.anonymous ?? me !== HOST, created_at: new Date(0).toISOString() };
  const sb = {
    from: (t: string) => builder(t),
    rpc: (name: string) => wait({ kind: "rpc", what: name }, null).then(() => ({ data: name === "event_counts" ? { mine: 1, total: n } : null, error: null })),
    storage: {
      from: () => ({
        createSignedUrl: (path: string) => wait({ kind: "storage", what: "sign" }, null).then(() => { const s = sign(path); return s.error ? { data: null, error: { message: s.error } } : { data: { signedUrl: s.signedUrl }, error: null }; }),
        createSignedUrls: (paths: string[]) => wait({ kind: "storage", what: `signMany(${paths.length})` }, null).then(() => ({ data: paths.map(sign), error: null })),
      }),
    },
    auth: {
      getUser: () => wait({ kind: "auth", what: "getUser" }, null).then(() => ({ data: { user }, error: null })),
      getSession: async () => ({ data: { session: { user, access_token: "t" } }, error: null }),
    },
  };
  return { sb: sb as unknown as SupabaseClient, calls };
}

/** Roda `fn` no relógio falso e devolve o resultado e quantas idas em série (degraus de LATENCY) ela levou. */
export async function measure<T>(advance: (ms: number) => Promise<unknown>, fn: () => Promise<T>): Promise<{ value: T; serial: number }> {
  let done = false;
  let value: T | undefined;
  let error: unknown;
  const p = fn().then((v) => { value = v; done = true; }, (e) => { error = e; done = true; });
  let steps = 0;
  await advance(0);
  while (!done && steps < 200) {
    await advance(LATENCY);
    steps++;
  }
  await p;
  if (error) throw error;
  return { value: value as T, serial: steps };
}
