import { canJoin, type MemoEvent } from "@/domain/event";
import { normalizeShareCode } from "@/domain/share-code";
import type { Participant, Repositories, User } from "@/repositories";

export type JoinOutcome =
  | { ok: true; event: MemoEvent; participant: Participant }
  | { ok: false; reason: "codigo" | "encerrado" | "lotado" | "nome" };

/** Entrar na festa por código (REA F-05/F-11). Identidade local; entrada real depende do backend. */
export async function joinEvent(repos: Repositories, user: User, codeInput: string, name: string, now: number, tableLabel?: string): Promise<JoinOutcome> {
  const code = normalizeShareCode(codeInput);
  if (!code) return { ok: false, reason: "codigo" };
  const event = await repos.events.getByCode(code);
  if (!event) return { ok: false, reason: "codigo" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "nome" };
  const existing = await repos.participants.get(event.id, user.id);
  const count = (await repos.participants.listByEvent(event.id)).length;
  const verdict = canJoin(event, count, now, Boolean(existing) || event.hostId === user.id);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const participant: Participant = { eventId: event.id, userId: user.id, name: trimmed, joinedAt: existing?.joinedAt ?? now, tableLabel: tableLabel ?? existing?.tableLabel };
  await repos.participants.put(participant);
  return { ok: true, event, participant };
}
