import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import { paginate, sortNewestFirst } from "../paging";
import { RepositoryError, type EventPreview, type Invitation, type Participant, type PhotoData, type Repositories, type RepositoryErrorCode, type User } from "../types";

/**
 * Adaptador Supabase atrás do MESMO contrato dos adaptadores locais. A autorização é do servidor (RLS, triggers, RPC);
 * este arquivo só traduz linhas, erros e chamadas. Componentes visuais nunca importam o SDK.
 */
const BUCKET = "event-photos";
const PAGE = 1000; // PostgREST trunca em 1000 linhas por requisição

type Row = Record<string, unknown>;
const ms = (v: unknown): number | undefined => (typeof v === "string" ? Date.parse(v) : undefined);
const iso = (v: number | null | undefined): string | null => (v === null || v === undefined ? null : new Date(v).toISOString());

const PG_CODES: Record<string, RepositoryErrorCode> = {
  MM001: "shot-limit", MM002: "event-ended", MM003: "capacity-full", MM004: "forbidden", MM005: "invalid", MM006: "rate-limited",
  MM007: "invalid-invite", MM008: "reveal-locked", MM009: "reopen-forbidden", "42501": "forbidden", "23505": "conflict", PGRST116: "not-found",
};

/** Traduz erro do PostgREST/Storage para o erro tipado do contrato. Falha de rede é `unavailable`. */
export function toRepositoryError(err: { code?: string; message?: string; statusCode?: string | number; status?: number } | unknown): RepositoryError {
  const e = (err ?? {}) as { code?: string; message?: string; statusCode?: string | number; status?: number; name?: string };
  const mapped = e.code ? PG_CODES[e.code] : undefined;
  if (mapped) return new RepositoryError(mapped, e.message ?? mapped, err);
  const http = Number(e.statusCode ?? e.status);
  if (http === 403 || http === 401) return new RepositoryError("forbidden", e.message ?? "negado", err);
  if (http === 404) return new RepositoryError("not-found", e.message ?? "não encontrado", err);
  if (http === 400 || http === 413 || http === 415) return new RepositoryError("invalid", e.message ?? "inválido", err);
  return new RepositoryError("unavailable", e.message ?? "servidor indisponível", err);
}

function ok<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw toRepositoryError(res.error);
  return res.data as T;
}

const toEvent = (r: Row): MemoEvent => ({
  id: r.id as string, code: r.code as string, title: r.title as string, category: r.category as MemoEvent["category"],
  hostId: r.host_id as string, hostName: r.host_name as string, startAt: ms(r.start_at)!, durationHours: Number(r.duration_hours),
  endedAt: ms(r.ended_at), cameraStyle: r.camera_style as MemoEvent["cameraStyle"],
  revealEnabled: r.reveal_enabled as boolean, revealAt: ms(r.reveal_at) ?? null, revealAnchor: r.reveal_anchor as MemoEvent["revealAnchor"],
  revealOffsetDays: r.reveal_offset_days as number, timezone: r.timezone as string, revealStatus: r.reveal_status as MemoEvent["revealStatus"],
  revealedAt: ms(r.revealed_at) ?? null, version: r.version as number,
  capacity: r.capacity as MemoEvent["capacity"], shotsPerPerson: r.shots_per_person as MemoEvent["shotsPerPerson"],
  everyoneSeesAll: r.everyone_sees_all as boolean, reactionsEnabled: r.reactions_enabled as boolean,
  palette: r.palette as MemoEvent["palette"], eventFont: r.event_font as MemoEvent["eventFont"], place: (r.place as string | null) ?? undefined,
  moments: (r.moments as string[]) ?? [], tables: r.tables as number,
  notice: (r.notice as MemoEvent["notice"] | null) ?? undefined, createdAt: ms(r.created_at)!,
});

/** Colunas editáveis pelo cliente. host_id, code, version, revealed_at, reveal_status e created_at são do servidor. */
const eventPatch = (e: MemoEvent): Row => ({
  title: e.title, category: e.category, host_name: e.hostName, start_at: iso(e.startAt), duration_hours: e.durationHours, ended_at: iso(e.endedAt),
  camera_style: e.cameraStyle, reveal_enabled: e.revealEnabled, reveal_at: iso(e.revealAt), reveal_anchor: e.revealAnchor,
  reveal_offset_days: e.revealOffsetDays, timezone: e.timezone, capacity: e.capacity, shots_per_person: e.shotsPerPerson,
  everyone_sees_all: e.everyoneSeesAll, reactions_enabled: e.reactionsEnabled, palette: e.palette, event_font: e.eventFont,
  place: e.place ?? null, moments: e.moments, tables: e.tables, notice: e.notice ?? null,
});

const toPhoto = (r: Row): Photo => ({
  id: r.id as string, eventId: r.event_id as string, authorId: (r.author_id as string | null) ?? "", authorName: r.author_name as string,
  createdAt: ms(r.created_at)!, moment: r.moment as string, caption: (r.caption as string | null) ?? undefined,
  tableLabel: (r.table_label as string | null) ?? undefined, status: r.status as Photo["status"], reports: r.reports as number,
  highlighted: r.highlighted as boolean, version: r.version as number, uploadStatus: r.upload_status as Photo["uploadStatus"],
  capturedAt: ms(r.captured_at),
});

const toReaction = (r: Row): Reaction => ({ eventId: r.event_id as string, photoId: r.photo_id as string, authorId: r.author_id as string, kind: r.kind as Reaction["kind"] });

export function createSupabaseRepositories(sb: SupabaseClient): Repositories {
  /** begin() grava o caminho aqui: o autor não consegue ler a própria foto antes da revelação (RLS), então lembramos o que criamos. */
  const begun = new Map<string, Photo>();
  const pathOf = (id: string) => {
    const p = begun.get(id);
    if (!p) throw new RepositoryError("not-found", `Foto ${id}: begin() não foi chamado neste cliente`);
    return `${p.eventId}/${id}`;
  };
  const selectAll = async (table: string, build: (q: ReturnType<typeof sb.from>) => unknown): Promise<Row[]> => {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const q = (build(sb.from(table)) as { range: (a: number, b: number) => PromiseLike<{ data: Row[] | null; error: unknown }> }).range(from, from + PAGE - 1);
      const rows = ok(await q) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  };

  return {
    events: {
      preview: async (code) => {
        const d = ok(await sb.rpc("event_preview", { p_code: code }));
        return d ? ({ ...(d as EventPreview), startAt: Date.parse(d.startAt as string), place: d.place ?? undefined } as EventPreview) : undefined;
      },
      counts: async (eventId) => {
        const d = ok(await sb.rpc("event_counts", { p_event: eventId })) as { mine: number; total: number };
        return { mine: Number(d.mine), total: Number(d.total) };
      },
      join: async (code, name, table, token) => {
        const d = ok(await sb.rpc("join_event", { p_code: code, p_name: name, p_table: table ?? null, p_token: token ?? null })) as { role: "organizador" | "membro"; eventId: string };
        return d;
      },
      list: async () => (await selectAll("events", (q) => q.select("*").order("created_at", { ascending: false }))).map(toEvent),
      get: async (id) => {
        const r = ok(await sb.from("events").select("*").eq("id", id).maybeSingle());
        return r ? toEvent(r) : undefined;
      },
      getByCode: async (code) => {
        const r = ok(await sb.from("events").select("*").eq("code", code).maybeSingle());
        return r ? toEvent(r) : undefined;
      },
      save: async (e, opts) => {
        const exists = opts?.expectedVersion !== undefined || ok(await sb.from("events").select("id").eq("id", e.id).maybeSingle()) !== null;
        if (!exists) {
          // code, version e horários de controle são do servidor; o cliente só informa quem cria e as configurações
          return toEvent(ok(await sb.from("events").insert({ ...eventPatch(e), id: e.id, host_id: e.hostId }).select("*").single()));
        }
        let q = sb.from("events").update(eventPatch(e)).eq("id", e.id);
        if (opts?.expectedVersion !== undefined) q = q.eq("version", opts.expectedVersion);
        const rows = ok(await q.select("*"));
        if (rows?.length) return toEvent(rows[0]);
        const cur = ok(await sb.from("events").select("version").eq("id", e.id).maybeSingle());
        if (!cur) throw new RepositoryError("not-found", `Evento ${e.id} não existe (apagado?)`);
        throw new RepositoryError("conflict", `Evento ${e.id}: versão ${opts?.expectedVersion} desatualizada (atual ${(cur as Row).version})`);
      },
      remove: async (id) => void ok(await sb.rpc("delete_event", { p_event: id })),
    },
    participants: {
      listByEvent: async (id) => (await selectAll("participants", (q) => q.select("*").eq("event_id", id).order("joined_at"))).map(toParticipant),
      count: async (id) => {
        const r = await sb.from("participants").select("user_id", { count: "exact", head: true }).eq("event_id", id);
        if (r.error) throw toRepositoryError(r.error);
        return r.count ?? 0;
      },
      get: async (e, u) => {
        const r = ok(await sb.from("participants").select("*").eq("event_id", e).eq("user_id", u).maybeSingle());
        return r ? toParticipant(r) : undefined;
      },
      // entrar é RPC (events.join); aqui só se atualiza nome/mesa de quem já entrou
      put: async (p) => {
        const rows = ok(await sb.from("participants").update({ name: p.name, table_label: p.tableLabel ?? null }).eq("event_id", p.eventId).eq("user_id", p.userId).select("user_id"));
        if (!rows?.length) throw new RepositoryError("forbidden", "Participante entra pela RPC join_event");
      },
      remove: async (e, u) => void ok(await sb.from("participants").delete().eq("event_id", e).eq("user_id", u)),
      removeByEvent: async () => undefined, // cascata do banco (delete_event)
    },
    photos: {
      listByEvent: async (id) => sortNewestFirst((await selectAll("photos", (q) => q.select("*").eq("event_id", id).eq("upload_status", "pronta").order("created_at", { ascending: false }))).map(toPhoto)),
      count: async (id, f) => {
        let q = sb.from("photos").select("id", { count: "exact", head: true }).eq("event_id", id);
        if (f?.authorId) q = q.eq("author_id", f.authorId);
        if (f?.status) q = q.eq("status", f.status);
        if (f?.excludeStatus) q = q.neq("status", f.excludeStatus);
        const r = await q;
        if (r.error) throw toRepositoryError(r.error);
        return r.count ?? 0;
      },
      page: async (id, o) => {
        // o servidor já aplica a visibilidade; a paginação por cursor (createdAt|id) é a mesma do contrato local
        const all = sortNewestFirst((await selectAll("photos", (q) => q.select("*").eq("event_id", id).eq("upload_status", "pronta"))).map(toPhoto));
        return paginate(all, o);
      },
      get: async (id) => {
        const r = ok(await sb.from("photos").select("*").eq("id", id).maybeSingle());
        return r ? toPhoto(r) : undefined;
      },
      begin: async (p) => {
        ok(await sb.rpc("begin_photo", { p_id: p.id, p_event: p.eventId, p_moment: p.moment, p_caption: p.caption ?? null, p_table: p.tableLabel ?? null, p_captured_at: iso(p.capturedAt ?? p.createdAt) }));
        const saved = { ...p, uploadStatus: "enviando" as const };
        begun.set(p.id, saved);
        return saved;
      },
      attach: async (id, data) => {
        const r = await sb.storage.from(BUCKET).upload(pathOf(id), new Blob([data.bytes], { type: data.type }), { contentType: data.type, upsert: false });
        if (r.error) throw toRepositoryError(r.error);
      },
      finalize: async (id) => {
        ok(await sb.rpc("finalize_photo", { p_id: id }));
        const p = begun.get(id);
        if (!p) throw new RepositoryError("not-found", `Foto ${id}`);
        const done = { ...p, uploadStatus: "pronta" as const };
        begun.set(id, done);
        return done;
      },
      pending: async (eventId) => (await selectAll("photos", (q) => q.select("*").eq("event_id", eventId).neq("upload_status", "pronta"))).map(toPhoto),
      add: async (p, d) => {
        const r = ok(await sb.rpc("begin_photo", { p_id: p.id, p_event: p.eventId, p_moment: p.moment, p_caption: p.caption ?? null, p_table: p.tableLabel ?? null, p_captured_at: iso(p.capturedAt ?? p.createdAt) })) as { uploadStatus: string };
        if (r.uploadStatus === "pronta") return; // idempotente: reenvio de foto já publicada
        begun.set(p.id, { ...p, uploadStatus: "enviando" });
        const up = await sb.storage.from(BUCKET).upload(pathOf(p.id), new Blob([d.bytes], { type: d.type }), { contentType: d.type, upsert: false });
        if (up.error && !/already exists|Duplicate/i.test(up.error.message)) throw toRepositoryError(up.error);
        ok(await sb.rpc("finalize_photo", { p_id: p.id }));
      },
      update: async (p, opts) => {
        let q = sb.from("photos").update({ status: p.status, highlighted: p.highlighted }).eq("id", p.id);
        if (opts?.expectedVersion !== undefined) q = q.eq("version", opts.expectedVersion);
        const rows = ok(await q.select("*"));
        if (rows?.length) return toPhoto(rows[0]);
        const cur = ok(await sb.from("photos").select("version").eq("id", p.id).maybeSingle());
        if (!cur) throw new RepositoryError("not-found", `Foto ${p.id} não existe`);
        throw new RepositoryError("conflict", `Foto ${p.id}: versão ${opts?.expectedVersion} desatualizada`);
      },
      getData: async (id) => {
        const p = ok(await sb.from("photos").select("storage_path, mime").eq("id", id).maybeSingle()) as Row | null;
        if (!p) return undefined;
        const r = await sb.storage.from(BUCKET).download(p.storage_path as string);
        if (r.error) return undefined; // bloqueada ou inexistente: o Storage nega
        return { bytes: await r.data.arrayBuffer(), type: (p.mime as string) ?? r.data.type } as PhotoData;
      },
      getUrl: async (id, size) => {
        const p = ok(await sb.from("photos").select("storage_path").eq("id", id).maybeSingle()) as Row | null;
        if (!p) return undefined;
        const base = p.storage_path as string;
        for (const path of size === "thumb" ? [`${base}.thumb`, base] : [base]) {
          const r = await sb.storage.from(BUCKET).createSignedUrl(path, 60);
          if (!r.error) return { url: r.data.signedUrl, release: () => undefined };
        }
        return undefined;
      },
      remove: async (id) => void ok(await sb.rpc("discard_photo", { p_id: id })),
      removeByEvent: async () => undefined, // cascata do banco (delete_event)
    },
    reactions: {
      listByEvent: async (id) => (await selectAll("reactions", (q) => q.select("*").eq("event_id", id))).map(toReaction),
      put: async (r) => void ok(await sb.from("reactions").upsert({ photo_id: r.photoId, author_id: r.authorId, event_id: r.eventId, kind: r.kind }, { onConflict: "photo_id,author_id" })),
      remove: async (photoId, authorId) => void ok(await sb.from("reactions").delete().eq("photo_id", photoId).eq("author_id", authorId)),
      removeByPhoto: async () => undefined, // cascata do banco
      removeByEvent: async () => undefined,
    },
    invitations: {
      listByEvent: async (id) => (await selectAll("invitations", (q) => q.select("id, event_id, label, created_at").eq("event_id", id))).map((r): Invitation => ({ id: r.id as string, eventId: r.event_id as string, label: r.label as string, createdAt: ms(r.created_at)! })),
      put: async (i) => void ok(await sb.rpc("create_invitation", { p_event: i.eventId, p_label: i.label })),
      remove: async (id) => void ok(await sb.rpc("revoke_invitation", { p_invitation: id })),
      removeByEvent: async () => undefined,
    },
    users: {
      current: async () => {
        const { data } = await sb.auth.getUser();
        if (!data.user) return undefined;
        const prof = ok(await sb.from("profiles").select("display_name, created_at").eq("id", data.user.id).maybeSingle()) as Row | null;
        return { id: data.user.id, name: (prof?.display_name as string) ?? "", createdAt: ms(prof?.created_at) ?? Date.parse(data.user.created_at) } as User;
      },
      // a identidade é a da sessão (auth.uid()): sem sessão, entra como convidado anônimo; só o nome de exibição é gravado
      save: async (u) => {
        let { data } = await sb.auth.getUser();
        if (!data.user) {
          const r = await sb.auth.signInAnonymously();
          if (r.error) throw toRepositoryError(r.error);
          data = { user: r.data.user! };
        }
        ok(await sb.from("profiles").update({ display_name: u.name }).eq("id", data.user!.id));
      },
      clear: async () => void (await sb.auth.signOut()),
      known: async () => [],
      switchTo: async () => undefined, // não existe troca de pessoa na nuvem (identityPolicy)
    },
  };
}

const toParticipant = (r: Row): Participant => ({ eventId: r.event_id as string, userId: r.user_id as string, name: r.name as string, joinedAt: ms(r.joined_at)!, tableLabel: (r.table_label as string | null) ?? undefined });
