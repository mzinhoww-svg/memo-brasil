import { canEditEnd, endAt, validateDraft, type DraftErrors, type MemoEvent, type EventFontId, type PaletteId } from "@/domain/event";
import { generateShareCode } from "@/domain/share-code";
import type { CameraStyle, Capacity, EventCategory, FilmLook, Shots } from "@/domain/options";
import { canEditReveal, computeRevealStatus, syncRevealWithEnd, type RevealErrors } from "@/domain/reveal";
import { resolveReveal, type RevealInput } from "./reveal-input";
import { deleteEventCascade, RepositoryError, type Repositories, type User } from "@/repositories";

export interface EventInput {
  title: string;
  category: EventCategory;
  durationHours: number;
  reveal: RevealInput;
  cameraStyle: CameraStyle;
  filmLook?: FilmLook;
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

export type CreateResult = { ok: true; event: MemoEvent } | { ok: false; errors: DraftErrors & { reveal?: RevealErrors; save?: true } };

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
    ...(input.filmLook ? { filmLook: input.filmLook } : {}),
    revealEnabled: reveal.enabled,
    revealAt: reveal.at,
    revealAnchor: reveal.anchor,
    revealOffsetDays: reveal.offsetDays,
    timezone: reveal.timezone,
    revealStatus: computeRevealStatus({ revealEnabled: reveal.enabled, revealAt: reveal.at }, now),
    revealedAt: null,
    version: 1,
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
  try {
    return { ok: true, event: await repos.events.save(event) }; // o repositório devolve o gravado (no servidor: código e horários dele)
  } catch (e) {
    if (e instanceof RepositoryError) return { ok: false, errors: { save: true } }; // a tela mostra o erro e destrava o botão
    throw e;
  }
}

type Step<R> = { fail: R } | { next: MemoEvent; done: (saved: MemoEvent) => R };

/**
 * Leitura-modificação-gravação com concorrência otimista: grava com a versão lida e, se outra escrita passou na frente
 * (`conflict`), relê e refaz a decisão sobre o estado novo. Nenhuma atualização concorrente se perde (BG-113).
 */
export async function mutateEvent<R>(repos: Repositories, eventId: string, notFound: R, step: (e: MemoEvent) => Promise<Step<R>>): Promise<R> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const e = await repos.events.get(eventId);
    if (!e) return notFound;
    const s = await step(e);
    if ("fail" in s) return s.fail;
    try {
      return s.done(await repos.events.save(s.next, { expectedVersion: e.version }));
    } catch (err) {
      if (err instanceof RepositoryError && err.code === "not-found") return notFound; // o evento foi apagado no meio
      if (!(err instanceof RepositoryError && err.code === "conflict")) throw err;
    }
  }
  throw new RepositoryError("conflict", `Evento ${eventId}: muitas escritas concorrentes`);
}

export type UpdateResult = { ok: true; event: MemoEvent } | { ok: false; reason: "encerrado-com-fotos" | "termino-curto" | "inexistente" };

/** Altera a duração/fim. Álbum encerrado com fotos não reabre (REA F-36). */
export async function setEndIn(repos: Repositories, eventId: string, hoursFromNow: number, now: number): Promise<UpdateResult> {
  return mutateEvent<UpdateResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    const photoCount = await repos.photos.count(eventId, { excludeStatus: "removida" });
    if (!canEditEnd(e, photoCount, now)) return { fail: { ok: false, reason: "encerrado-com-fotos" } };
    if (hoursFromNow < 0.5) return { fail: { ok: false, reason: "termino-curto" } };
    const moved: MemoEvent = { ...e, endedAt: undefined, durationHours: (now + hoursFromNow * 3_600_000 - e.startAt) / 3_600_000 };
    return { next: withStatus(syncRevealWithEnd(moved, now), now), done: (event) => ({ ok: true, event }) };
  });
}

/** Recalcula o espelho `revealStatus` a partir do relógio. */
const withStatus = (e: MemoEvent, now: number): MemoEvent => ({ ...e, revealStatus: computeRevealStatus(e, now) });

export async function endEventNow(repos: Repositories, eventId: string, now: number): Promise<MemoEvent | undefined> {
  return mutateEvent<MemoEvent | undefined>(repos, eventId, undefined, async (e) => {
    if (now >= endAt(e)) return { fail: e };
    return { next: withStatus(syncRevealWithEnd({ ...e, endedAt: now }, now), now), done: (event) => event };
  });
}

export type SettingsResult = { ok: true; event: MemoEvent } | { ok: false; reason: "inexistente" | "capacidade-menor-que-convidados" };

export async function updateSettings(repos: Repositories, eventId: string, patch: Partial<Pick<MemoEvent, "title" | "hostName" | "place" | "shotsPerPerson" | "capacity" | "everyoneSeesAll" | "reactionsEnabled" | "tables" | "notice" | "palette" | "eventFont" | "moments" | "cameraStyle" | "filmLook">>): Promise<SettingsResult> {
  return mutateEvent<SettingsResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    if (patch.capacity !== undefined && patch.capacity !== null && patch.capacity < (await repos.participants.count(eventId))) return { fail: { ok: false, reason: "capacidade-menor-que-convidados" } };
    return { next: { ...e, ...patch }, done: (event) => ({ ok: true, event }) };
  });
}

export async function deleteEvent(repos: Repositories, eventId: string): Promise<void> {
  await deleteEventCascade(repos, { id: eventId });
}

export type UpdateRevealResult =
  | { ok: true; event: MemoEvent }
  | { ok: false; reason: "inexistente" | "ja-revelada" | "fotos-ja-visiveis" | "invalido"; errors?: RevealErrors };

/** Altera a revelação programada. Depois de revelada, ou para esconder fotos já visíveis, o organizador não consegue. */
export async function updateReveal(repos: Repositories, eventId: string, input: RevealInput, now: number): Promise<UpdateRevealResult> {
  return mutateEvent<UpdateRevealResult>(repos, eventId, { ok: false, reason: "inexistente" }, async (e) => {
    const photoCount = await repos.photos.count(eventId, { excludeStatus: "removida" });
    const verdict = canEditReveal(e, photoCount, now, input.enabled);
    if (!verdict.ok) return { fail: { ok: false, reason: verdict.reason } };
    const r = resolveReveal(input, endAt(e), now);
    if (!r.ok) return { fail: { ok: false, reason: "invalido", errors: r.errors } };
    const next: MemoEvent = { ...e, revealEnabled: r.enabled, revealAt: r.at, revealAnchor: r.anchor, revealOffsetDays: r.offsetDays, timezone: r.timezone, revealStatus: computeRevealStatus({ revealEnabled: r.enabled, revealAt: r.at }, now), revealedAt: null };
    return { next, done: (event) => ({ ok: true, event }) };
  });
}

/**
 * Espelha no armazenamento o estado calculado pelo relógio (reveal_status). Idempotente: sem mudança, não grava.
 * No backend esta é a tarefa agendada (pg_cron) que roda no horário, não um timer do navegador.
 */
export async function reconcileReveal(repos: Repositories, eventId: string, now: number): Promise<MemoEvent | undefined> {
  return mutateEvent<MemoEvent | undefined>(repos, eventId, undefined, async (e) => {
    const status = computeRevealStatus(e, now);
    // grava revealedAt uma única vez, no horário agendado; relógio recuado não desfaz
    const revealedAt = e.revealedAt ?? (status === "revelada" && e.revealEnabled ? e.revealAt : null);
    if (status === e.revealStatus && revealedAt === (e.revealedAt ?? null)) return { fail: e };
    return { next: { ...e, revealStatus: status, revealedAt }, done: (event) => event };
  });
}
