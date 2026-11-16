import type { MemoEvent } from "@/domain/event";
import { validateTheme, type ThemeSpec } from "@/lib/event-theme/spec";
import type { Repositories } from "@/repositories";
import { mutateEvent } from "./service";

export type ThemeResult = { ok: true; event: MemoEvent } | { ok: false; reason: "inexistente" | "invalido"; errors?: string[] };

/** A aparência continua editável depois da revelação (decisão do dono); só a configuração da revelação em si trava. */
export async function saveTheme(repos: Repositories, eventId: string, theme: ThemeSpec): Promise<ThemeResult> {
  const v = validateTheme(theme);
  return mutateEvent<ThemeResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    if (!v.ok) return { fail: { ok: false, reason: "invalido", errors: v.errors } };
    return { next: { ...e, theme }, done: (event) => ({ ok: true, event }) };
  });
}

export async function restoreDefaultTheme(repos: Repositories, eventId: string): Promise<ThemeResult> {
  return mutateEvent<ThemeResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    const { theme: _drop, ...rest } = e;
    void _drop;
    return { next: rest as MemoEvent, done: (event) => ({ ok: true, event }) };
  });
}
