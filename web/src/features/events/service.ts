import { canEditEnd, endAt, validateDraft, type DraftErrors, type MemoEvent, type EventFontId, type PaletteId } from "@/domain/event";
import { generateShareCode } from "@/domain/share-code";
import type { CameraStyle, Capacity, EventCategory, Shots } from "@/domain/options";
import { canEditReveal, computeRevealStatus, syncRevealWithEnd, type RevealErrors } from "@/domain/reveal";
import { resolveReveal, type RevealInput } from "./reveal-input";
import { deleteEventCascade, type Repositories, type User } from "@/repositories";

export interface EventInput {
  title: string;
  category: EventCategory;
  durationHours: number;
  reveal: RevealInput;
  cameraStyle: CameraStyle;
  capacity: Capacity;
  shotsPerPerson: Shots;
  everyoneSeesAll: boolean;
  palette: PaletteId;
  eventFont: EventFontId;
  place?: string;
  moments?: string[];
  tables?: number;
}

export const DEFAULT_MOMENTS = ["Chegada", "O sim", "Pôr do sol", "Pista"];

export type CreateResult = { ok: true; event: MemoEvent } | { ok: false; errors: DraftErrors & { reveal?: RevealErrors } };

export async function createEvent(repos: Repositories, host: User, input: EventInput, now: number): Promise<CreateResult> {
  const errors = validateDraft({ title: input.title, startAt: now, durationHours: input.durationHours }, now);
  if (Object.keys(errors).length) return { ok: false, errors };
  const endMs = now + input.durationHours * 3_600_000;
  const reveal = resolveReveal(input.reveal, endMs, now);
  if (!reveal.ok) return { ok: false, errors: { reveal: reveal.errors } };
  let code = generateShareCode();
  for (let i = 0; i < 20 && (await repos.events.getByCode(code)); i++) code = generateShareCode();
  const event: MemoEvent = {
    id: crypto.randomUUID(),
    code,
    title: input.title.trim(),
    category: input.category,
    hostId: host.id,
    hostName: host.name,
    startAt: now,
    durationHours: input.durationHours,
    cameraStyle: input.cameraStyle,
    revealEnabled: reveal.enabled,
    revealAt: reveal.at,
    revealAnchor: reveal.anchor,
    revealOffsetDays: reveal.offsetDays,
    timezone: reveal.timezone,
    revealStatus: computeRevealStatus({ revealEnabled: reveal.enabled, revealAt: reveal.at }, now),
    capacity: input.capacity,
    shotsPerPerson: input.shotsPerPerson,
    everyoneSeesAll: input.everyoneSeesAll,
    reactionsEnabled: true,
    palette: input.palette,
    eventFont: input.eventFont,
    place: input.place?.trim() || undefined,
    moments: input.moments?.length ? input.moments : DEFAULT_MOMENTS,
    tables: input.tables ?? 0,
    createdAt: now,
  };
  await repos.events.save(event);
  return { ok: true, event };
}

export type UpdateResult = { ok: true; event: MemoEvent } | { ok: false; reason: "encerrado-com-fotos" | "termino-curto" | "inexistente" };

/** Altera a duração/fim. Álbum encerrado com fotos não reabre (REA F-36). */
export async function setEndIn(repos: Repositories, eventId: string, hoursFromNow: number, now: number): Promise<UpdateResult> {
  const e = await repos.events.get(eventId);
  if (!e) return { ok: false, reason: "inexistente" };
  const photoCount = (await repos.photos.listByEvent(eventId)).filter((p) => p.status !== "removida").length;
  if (!canEditEnd(e, photoCount, now)) return { ok: false, reason: "encerrado-com-fotos" };
  if (hoursFromNow < 0.5) return { ok: false, reason: "termino-curto" };
  const moved: MemoEvent = { ...e, endedAt: undefined, durationHours: (now + hoursFromNow * 3_600_000 - e.startAt) / 3_600_000 };
  const next = withStatus(syncRevealWithEnd(moved, now), now);
  await repos.events.save(next);
  return { ok: true, event: next };
}

/** Recalcula o espelho `revealStatus` a partir do relógio. */
const withStatus = (e: MemoEvent, now: number): MemoEvent => ({ ...e, revealStatus: computeRevealStatus(e, now) });

export async function endEventNow(repos: Repositories, eventId: string, now: number): Promise<MemoEvent | undefined> {
  const e = await repos.events.get(eventId);
  if (!e || now >= endAt(e)) return e;
  const next = withStatus(syncRevealWithEnd({ ...e, endedAt: now }, now), now);
  await repos.events.save(next);
  return next;
}

export type SettingsResult = { ok: true; event: MemoEvent } | { ok: false; reason: "inexistente" | "capacidade-menor-que-convidados" };

export async function updateSettings(repos: Repositories, eventId: string, patch: Partial<Pick<MemoEvent, "title" | "place" | "shotsPerPerson" | "capacity" | "everyoneSeesAll" | "reactionsEnabled" | "tables" | "notice" | "palette" | "eventFont" | "moments">>): Promise<SettingsResult> {
  const e = await repos.events.get(eventId);
  if (!e) return { ok: false, reason: "inexistente" };
  if (patch.capacity !== undefined && patch.capacity !== null && patch.capacity < (await repos.participants.listByEvent(eventId)).length) return { ok: false, reason: "capacidade-menor-que-convidados" };
  const next = { ...e, ...patch };
  await repos.events.save(next);
  return { ok: true, event: next };
}

export async function deleteEvent(repos: Repositories, eventId: string): Promise<void> {
  await deleteEventCascade(repos, { id: eventId });
}

export type UpdateRevealResult =
  | { ok: true; event: MemoEvent }
  | { ok: false; reason: "inexistente" | "ja-revelada" | "fotos-ja-visiveis" | "invalido"; errors?: RevealErrors };

/** Altera a revelação programada. Depois de revelada, ou para esconder fotos já visíveis, o organizador não consegue. */
export async function updateReveal(repos: Repositories, eventId: string, input: RevealInput, now: number): Promise<UpdateRevealResult> {
  const e = await repos.events.get(eventId);
  if (!e) return { ok: false, reason: "inexistente" };
  const photoCount = (await repos.photos.listByEvent(eventId)).filter((p) => p.status !== "removida").length;
  const verdict = canEditReveal(e, photoCount, now, input.enabled);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const r = resolveReveal(input, endAt(e), now);
  if (!r.ok) return { ok: false, reason: "invalido", errors: r.errors };
  const next: MemoEvent = { ...e, revealEnabled: r.enabled, revealAt: r.at, revealAnchor: r.anchor, revealOffsetDays: r.offsetDays, timezone: r.timezone, revealStatus: computeRevealStatus({ revealEnabled: r.enabled, revealAt: r.at }, now) };
  await repos.events.save(next);
  return { ok: true, event: next };
}

/**
 * Espelha no armazenamento o estado calculado pelo relógio (reveal_status). Idempotente: sem mudança, não grava.
 * No backend esta é a tarefa agendada (pg_cron) que roda no horário, não um timer do navegador.
 */
export async function reconcileReveal(repos: Repositories, eventId: string, now: number): Promise<MemoEvent | undefined> {
  const e = await repos.events.get(eventId);
  if (!e) return undefined;
  const status = computeRevealStatus(e, now);
  if (status === e.revealStatus) return e;
  const next = { ...e, revealStatus: status };
  await repos.events.save(next);
  return next;
}
