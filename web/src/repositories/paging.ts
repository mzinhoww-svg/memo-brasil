import type { Photo } from "@/domain/photo";
import type { Page, PhotoCountFilter } from "./types";

/** Cursor opaco = base64("createdAt|id") do último item entregue; ordem estável: mais nova primeiro, desempate por id. */
const encode = (p: Pick<Photo, "createdAt" | "id">) => btoa(`${p.createdAt}|${p.id}`);
const decode = (c: string): { createdAt: number; id: string } => {
  const [t, ...id] = atob(c).split("|");
  return { createdAt: Number(t), id: id.join("|") };
};

export const sortNewestFirst = (list: Photo[]): Photo[] => [...list].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));

export const matchesFilter = (p: Photo, f: PhotoCountFilter = {}): boolean =>
  (f.authorId === undefined || p.authorId === f.authorId) && (f.excludeStatus === undefined || p.status !== f.excludeStatus);

/** Linha como o repositório a grava na fase 1: `createdAt` do relógio do repositório (se houver), `capturedAt` do cliente. */
export function beginRow(photo: Photo, now?: () => number): Photo {
  return { ...photo, uploadStatus: "enviando", capturedAt: photo.capturedAt ?? photo.createdAt, createdAt: now ? now() : photo.createdAt };
}
export const isPublished = (p: Photo): boolean => p.uploadStatus === "pronta";

export function paginate(sorted: Photo[], opts: { limit: number; cursor?: string | null }): Page<Photo> {
  let start = 0;
  if (opts.cursor) {
    const c = decode(opts.cursor);
    start = sorted.findIndex((p) => p.createdAt < c.createdAt || (p.createdAt === c.createdAt && p.id < c.id));
    if (start === -1) start = sorted.length;
  }
  const items = sorted.slice(start, start + opts.limit);
  const more = start + items.length < sorted.length;
  return { items, total: sorted.length, nextCursor: more && items.length > 0 ? encode(items[items.length - 1]) : null };
}
