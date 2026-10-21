import { canEditEnd, endAt, validateDraft, type DraftErrors, type MemoEvent, type EventFontId, type PaletteId } from "@/domain/event";
import { generateShareCode } from "@/domain/share-code";
import type { CameraStyle, Capacity, EventCategory, RevealTiming, Shots } from "@/domain/options";
import { deleteEventCascade, type Repositories, type User } from "@/repositories";

export interface EventInput {
  title: string;
  category: EventCategory;
  durationHours: number;
  revealTiming: RevealTiming;
  revealDelayDays: number;
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

export type CreateResult = { ok: true; event: MemoEvent } | { ok: false; errors: DraftErrors };

export async function createEvent(repos: Repositories, host: User, input: EventInput, now: number): Promise<CreateResult> {
  const errors = validateDraft({ title: input.title, startAt: now, durationHours: input.durationHours }, now);
  if (Object.keys(errors).length) return { ok: false, errors };
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
    revealTiming: input.revealTiming,
    revealDelayDays: input.revealTiming === "depois" ? Math.max(1, input.revealDelayDays) : 0,
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
  const next: MemoEvent = { ...e, endedAt: undefined, durationHours: (now + hoursFromNow * 3_600_000 - e.startAt) / 3_600_000 };
  await repos.events.save(next);
  return { ok: true, event: next };
}

export async function endEventNow(repos: Repositories, eventId: string, now: number): Promise<MemoEvent | undefined> {
  const e = await repos.events.get(eventId);
  if (!e || now >= endAt(e)) return e;
  const next = { ...e, endedAt: now };
  await repos.events.save(next);
  return next;
}

export async function updateSettings(repos: Repositories, eventId: string, patch: Partial<Pick<MemoEvent, "title" | "place" | "revealTiming" | "revealDelayDays" | "shotsPerPerson" | "capacity" | "everyoneSeesAll" | "reactionsEnabled" | "tables" | "notice" | "palette" | "eventFont" | "moments">>): Promise<MemoEvent | undefined> {
  const e = await repos.events.get(eventId);
  if (!e) return undefined;
  const next = { ...e, ...patch };
  await repos.events.save(next);
  return next;
}

export async function deleteEvent(repos: Repositories, eventId: string): Promise<void> {
  await deleteEventCascade(repos, { id: eventId });
}
