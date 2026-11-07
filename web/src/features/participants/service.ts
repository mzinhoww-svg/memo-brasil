import { canJoin, type MemoEvent } from "@/domain/event";
import { normalizeShareCode } from "@/domain/share-code";
import { RepositoryError, type Participant, type Repositories, type User } from "@/repositories";
import { withLock } from "@/lib/lock";
import { takeFault } from "@/lib/test-faults";

export type JoinOutcome =
  | { ok: true; event: MemoEvent; participant: Participant }
  | { ok: false; reason: JoinFailure };
/** `ocupado` = limite de tentativas (tentar de novo logo); `inativo` = convite recusado pelo servidor; `rede` = sem conexão. */
export type JoinFailure = "codigo" | "encerrado" | "lotado" | "nome" | "ocupado" | "inativo" | "rede" | "bloqueado";

/** Entrar na festa por código (REA F-05/F-11). Identidade local; entrada real depende do backend. */
export async function joinEvent(repos: Repositories, user: User, codeInput: string, name: string, now: number, tableLabel?: string): Promise<JoinOutcome> {
  const code = normalizeShareCode(codeInput);
  if (!code) return { ok: false, reason: "codigo" };
  const fault = takeFault("join");
  if (fault) return { ok: false, reason: JOIN_REASON[fault] };
  if (repos.events.join) return joinOnServer(repos, user, code, name, tableLabel);
  const event = await repos.events.getByCode(code);
  if (!event) return { ok: false, reason: "codigo" };
  return withLock(`entrar:${event.id}`, () => joinLocked(repos, event, user, name, now, tableLabel));
}

const JOIN_REASON: Record<string, JoinFailure> = { "capacity-full": "lotado", "event-ended": "encerrado", invalid: "codigo", "rate-limited": "ocupado", forbidden: "inativo", unavailable: "rede", blocked: "bloqueado" };

async function joinLocked(repos: Repositories, event: MemoEvent, user: User, name: string, now: number, tableLabel?: string): Promise<JoinOutcome> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "nome" };
  const existing = await repos.participants.get(event.id, user.id);
  if (existing?.blockedAt !== undefined) return { ok: false, reason: "bloqueado" };
  const count = await repos.participants.count(event.id);
  const verdict = canJoin(event, count, now, Boolean(existing) || event.hostId === user.id);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const participant: Participant = { eventId: event.id, userId: user.id, name: trimmed, joinedAt: existing?.joinedAt ?? now, tableLabel: tableLabel ?? existing?.tableLabel };
  try {
    await repos.participants.put(participant);
  } catch (e) {
    if (e instanceof RepositoryError && e.code === "blocked") return { ok: false, reason: "bloqueado" };
    if (e instanceof RepositoryError && e.code === "capacity-full") return { ok: false, reason: "lotado" }; // o servidor fechou a lotação
    if (e instanceof RepositoryError && e.code === "event-ended") return { ok: false, reason: "encerrado" };
    throw e;
  }
  return { ok: true, event, participant };
}

/** Servidor: a entrada (lotação, encerramento, limite de tentativas) é decidida na RPC; aqui só traduzimos a recusa. */
async function joinOnServer(repos: Repositories, user: User, code: string, name: string, tableLabel?: string): Promise<JoinOutcome> {
  if (!name.trim()) return { ok: false, reason: "nome" };
  try {
    await repos.events.join!(code, name.trim(), tableLabel);
  } catch (e) {
    if (e instanceof RepositoryError) return { ok: false, reason: JOIN_REASON[e.code] ?? "codigo" };
    throw e;
  }
  const event = await repos.events.getByCode(code);
  if (!event) return { ok: false, reason: "codigo" };
  const participant = (await repos.participants.get(event.id, user.id)) ?? { eventId: event.id, userId: user.id, name: name.trim(), joinedAt: Date.now(), tableLabel };
  return { ok: true, event, participant };
}
