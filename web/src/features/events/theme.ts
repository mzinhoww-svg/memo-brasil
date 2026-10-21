import { computeRevealStatus } from "@/domain/reveal";
import type { MemoEvent } from "@/domain/event";
import { validateTheme, type ThemeSpec } from "@/lib/event-theme/spec";
import type { Repositories } from "@/repositories";
import { mutateEvent } from "./service";

export type ThemeResult = { ok: true; event: MemoEvent } | { ok: false; reason: "inexistente" | "bloqueado" | "invalido"; errors?: string[] };

/** A identidade só muda antes da revelação (depois, os convidados já viram o evento com ela). */
const locked = (e: MemoEvent, now: number) => e.revealEnabled && computeRevealStatus(e, now) === "revelada";

export async function saveTheme(repos: Repositories, eventId: string, theme: ThemeSpec, now: number): Promise<ThemeResult> {
  const v = validateTheme(theme);
  return mutateEvent<ThemeResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    if (locked(e, now)) return { fail: { ok: false, reason: "bloqueado" } };
    if (!v.ok) return { fail: { ok: false, reason: "invalido", errors: v.errors } };
    return { next: { ...e, theme }, done: (event) => ({ ok: true, event }) };
  });
}

export async function restoreDefaultTheme(repos: Repositories, eventId: string, now: number): Promise<ThemeResult> {
  return mutateEvent<ThemeResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    if (locked(e, now)) return { fail: { ok: false, reason: "bloqueado" } };
    const { theme: _drop, ...rest } = e;
    void _drop;
    return { next: rest as MemoEvent, done: (event) => ({ ok: true, event }) };
  });
}
