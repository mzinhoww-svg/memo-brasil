import "server-only";
import { rpcOr } from "../data";
import { collectPages, type EventLite } from "./lib";

type Sb = Parameters<typeof rpcOr>[0];
const PAGE = 100;
export const EVENTS_CAP = 1000;

export interface EventsLoad { events: EventLite[]; degraded: boolean; truncated: boolean }

/**
 * Eventos via admin_list_events_v2 (com isTest, planCode); sem a RPC nova usa admin_list_events
 * (sem isTest/planCode) e marca `degraded`. Devolve nulo se nem a antiga respondeu.
 */
export async function loadEvents(sb: Sb, withTests: boolean): Promise<EventsLoad | null> {
  let degraded = false;
  const r = await collectPages<EventLite>(async (offset) => {
    const res = await rpcOr<{ total: number; items: EventLite[] }>(sb, "admin_list_events_v2",
      { p_limit: PAGE, p_offset: offset, p_include_tests: withTests },
      { name: "admin_list_events", args: { p_limit: PAGE, p_offset: offset } });
    if (res.state !== "ok") return { ok: false };
    if (res.degraded) degraded = true;
    return { ok: true, total: res.data.total, items: res.data.items };
  }, PAGE, EVENTS_CAP);
  return r.failed ? null : { events: r.items, degraded, truncated: r.truncated };
}
