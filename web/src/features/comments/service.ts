import { browserSupabase } from "@/lib/supabase/client";

/** Comentário de uma foto (24e). Espelha o que `list_photo_comments` devolve. */
export interface PhotoComment {
  id: string;
  photoId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  likes: number;
  likedByMe: boolean;
  mine: boolean;
  createdAt: number;
}

export const COMMENT_MAX = 280;

/** Códigos do servidor: MM016 segundo fator · MM017 antes da revelação · MM018 sem consentimento · MM004 acesso · MM005 texto inválido · MM006 frequência. */
export type CommentFailure = "stepup" | "notrevealed" | "consentrequired" | "forbidden" | "invalid" | "rate-limited" | "unavailable" | "disabled";
export class CommentError extends Error {
  constructor(readonly code: CommentFailure, message?: string) {
    super(message ?? code);
  }
}

const PG: Record<string, CommentFailure> = { MM019:"disabled", MM016: "stepup", MM017: "notrevealed", MM018: "consentrequired", MM004: "forbidden", MM005: "invalid", MM006: "rate-limited", "42501": "forbidden" };

export function toCommentError(err: unknown): CommentError {
  if (err instanceof CommentError) return err;
  const e = (err ?? {}) as { code?: string; message?: string };
  return new CommentError((e.code && PG[e.code]) || "unavailable", e.message);
}

/** Texto para a pessoa, por falha. */
export function commentFailureText(code: CommentFailure): string {
  switch (code) {
    case "disabled": return "Os comentários estão desativados pela plataforma.";
    case "notrevealed": return "Os comentários abrem quando as fotos forem reveladas.";
    case "stepup": return "Confirme sua identidade em duas etapas para continuar.";
    case "consentrequired": return "Precisamos do seu consentimento para continuar.";
    case "forbidden": return "Você não tem acesso a esta foto.";
    case "invalid": return `Escreva de 1 a ${COMMENT_MAX} caracteres.`;
    case "rate-limited": return "Muitos comentários em pouco tempo. Espere um pouco e tente de novo.";
    default: return "Não deu para falar com o servidor. Tente de novo.";
  }
}

export interface CommentsApi {
  enabled?(): Promise<boolean>;
  /** foto → quantidade de comentários visíveis */
  counts(eventId: string): Promise<Record<string, number>>;
  list(photoId: string): Promise<PhotoComment[]>;
  post(photoId: string, body: string): Promise<void>;
  toggleLike(commentId: string): Promise<{ liked: boolean; likes: number }>;
  report(commentId: string, reason?: string): Promise<void>;
  remove(commentId: string): Promise<void>;
}

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/** Servidor: só RPCs (`post_comment`, `list_photo_comments`, `comment_counts`, `toggle_comment_like`, `report_comment`, `delete_my_comment`). */
export function createCloudComments(rpc: Rpc = (fn, args) => browserSupabase().rpc(fn, args) as unknown as ReturnType<Rpc>): CommentsApi {
  const call = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    try {
      const { data, error } = await rpc(fn, args);
      if (error) throw toCommentError(error);
      return data;
    } catch (e) {
      throw toCommentError(e);
    }
  };
  return {
    enabled: async()=>((await call("get_revela_features",{})) as {commentsEnabled?:boolean}|null)?.commentsEnabled!==false,
    counts: async (eventId) => ((await call("comment_counts", { p_event: eventId })) as Record<string, number>) ?? {},
    list: async (photoId) => {
      const rows = ((await call("list_photo_comments", { p_photo: photoId })) as Array<Record<string, unknown>>) ?? [];
      return rows.map((r) => ({
        id: String(r.id), photoId: String(r.photoId), authorId: (r.authorId as string | null) ?? null, authorName: String(r.authorName), body: String(r.body),
        likes: Number(r.likes ?? 0), likedByMe: Boolean(r.likedByMe), mine: Boolean(r.mine), createdAt: Date.parse(String(r.createdAt)),
      }));
    },
    post: async (photoId, body) => {
      const b = body.trim();
      if (b.length < 1 || b.length > COMMENT_MAX) throw new CommentError("invalid");
      await call("post_comment", { p_photo: photoId, p_body: b });
    },
    toggleLike: async (commentId) => (await call("toggle_comment_like", { p_comment: commentId })) as { liked: boolean; likes: number },
    report: async (commentId, reason) => void (await call("report_comment", reason ? { p_comment: commentId, p_reason: reason } : { p_comment: commentId })),
    remove: async (commentId) => void (await call("delete_my_comment", { p_comment: commentId })),
  };
}

interface LocalRow { id: string; photoId: string; eventId: string; authorId: string; authorName: string; body: string; createdAt: number; likedBy: string[]; reportedBy: string[] }
const KEY = "mm-comments-v1";

/** Modo local (sem servidor): guarda no aparelho, com as mesmas regras de texto, revelação, curtida única e 3 denúncias escondendo. */
export function createLocalComments(me: { id: string; name: string }, ctx: { revealed: () => boolean; eventOf: (photoId: string) => string | undefined }, storage: Pick<Storage, "getItem" | "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): CommentsApi {
  const read = (): LocalRow[] => {
    try { return JSON.parse(storage?.getItem(KEY) ?? "[]") as LocalRow[]; } catch { return []; }
  };
  const write = (rows: LocalRow[]) => { try { storage?.setItem(KEY, JSON.stringify(rows)); } catch { /* sem armazenamento: nada a fazer */ } };
  const visible = (r: LocalRow) => r.reportedBy.length < 3;
  const view = (r: LocalRow): PhotoComment => ({ id: r.id, photoId: r.photoId, authorId: r.authorId, authorName: r.authorName, body: r.body, likes: r.likedBy.length, likedByMe: r.likedBy.includes(me.id), mine: r.authorId === me.id, createdAt: r.createdAt });
  return {
    counts: async (eventId) => {
      const out: Record<string, number> = {};
      for (const r of read()) if (r.eventId === eventId && visible(r)) out[r.photoId] = (out[r.photoId] ?? 0) + 1;
      return out;
    },
    list: async (photoId) => (ctx.revealed() ? read().filter((r) => r.photoId === photoId && visible(r)).sort((a, b) => a.createdAt - b.createdAt).map(view) : []),
    post: async (photoId, body) => {
      if (!ctx.revealed()) throw new CommentError("notrevealed");
      const b = body.trim();
      const eventId = ctx.eventOf(photoId);
      if (b.length < 1 || b.length > COMMENT_MAX || !eventId) throw new CommentError("invalid");
      write([...read(), { id: crypto.randomUUID(), photoId, eventId, authorId: me.id, authorName: me.name, body: b, createdAt: Date.now(), likedBy: [], reportedBy: [] }]);
    },
    toggleLike: async (id) => {
      const rows = read();
      const r = rows.find((x) => x.id === id);
      if (!r) throw new CommentError("forbidden");
      r.likedBy = r.likedBy.includes(me.id) ? r.likedBy.filter((u) => u !== me.id) : [...r.likedBy, me.id];
      write(rows);
      return { liked: r.likedBy.includes(me.id), likes: r.likedBy.length };
    },
    report: async (id) => {
      const rows = read();
      const r = rows.find((x) => x.id === id);
      if (!r || r.authorId === me.id) throw new CommentError(r ? "invalid" : "forbidden");
      if (!r.reportedBy.includes(me.id)) r.reportedBy.push(me.id);
      write(rows);
    },
    remove: async (id) => {
      const rows = read();
      if (!rows.some((x) => x.id === id && x.authorId === me.id)) throw new CommentError("forbidden");
      write(rows.filter((x) => x.id !== id));
    },
  };
}

/** "agora", "2 min", "3 h", "5 d" (carimbo curto do comentário). */
export function commentAgo(createdAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86_400)} d`;
}
