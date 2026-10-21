import { eventStatus, isRevealed, shotsLeft, type MemoEvent } from "./event";

export type PhotoStatus = "visivel" | "oculta" | "removida";
export type ReactionKind = "amei" | "esse-momento" | "risada" | "uau";
export const REACTION_LABEL: Record<ReactionKind, string> = { amei: "Amei", "esse-momento": "Esse momento", risada: "Rachei", uau: "Uau" };

export interface Photo {
  id: string;
  eventId: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  moment: string;
  caption?: string;
  tableLabel?: string; // "Mesa 8"
  status: PhotoStatus;
  reports: number;
  highlighted: boolean; // "Escolha dos noivos"
  /** Concorrência otimista: incrementada pelo repositório a cada gravação. */
  version: number;
  /** Envio em duas fases: `enviando` (linha criada, bytes a caminho) → `pronta` (visível). */
  uploadStatus: "enviando" | "pronta" | "falhou";
  /** Quando o aparelho captou a foto; `createdAt` é o horário do repositório/servidor. */
  capturedAt?: number;
}

export interface Reaction {
  eventId: string;
  photoId: string;
  authorId: string;
  kind: ReactionKind;
}

export type PostResult = { ok: true } | { ok: false; reason: "rolo" | "encerrado" };

export function canPost(e: MemoEvent, usedShots: number, now: number): PostResult {
  if (eventStatus(e, now) === "encerrado") return { ok: false, reason: "encerrado" };
  const left = shotsLeft(e, usedShots);
  if (left !== null && left <= 0) return { ok: false, reason: "rolo" };
  return { ok: true };
}

/** Uma reação por autor e foto (REA E-17): repetir a mesma desfaz, outra troca. */
export function setReaction(list: Reaction[], target: { eventId: string; photoId: string; authorId: string }, kind: ReactionKind): Reaction[] {
  const { eventId, photoId, authorId } = target;
  const current = list.find((r) => r.photoId === photoId && r.authorId === authorId);
  const rest = list.filter((r) => !(r.photoId === photoId && r.authorId === authorId));
  return current?.kind === kind ? rest : [...rest, { eventId, photoId, authorId, kind }];
}

export interface Viewer {
  id: string;
  host: boolean;
}

export function visiblePhotos(e: MemoEvent, photos: Photo[], viewer: Viewer, now: number): Photo[] {
  return photos.filter((p) => {
    if (p.status === "removida") return false;
    if (viewer.host) return true;
    if (p.status === "oculta") return false;
    if (!isRevealed(e, now)) return false; // câmera descartável: nem as próprias fotos antes da revelação
    return p.authorId === viewer.id || e.everyoneSeesAll;
  });
}

export const report = (p: Photo): Photo => ({ ...p, reports: p.reports + 1 });
export const hide = (p: Photo): Photo => ({ ...p, status: "oculta" });
export const unhide = (p: Photo): Photo => ({ ...p, status: "visivel", reports: 0 });
export const remove = (p: Photo): Photo => ({ ...p, status: "removida" });
export const toggleHighlight = (p: Photo): Photo => ({ ...p, highlighted: !p.highlighted });

export function moderationQueue(photos: Photo[]): Photo[] {
  return photos.filter((p) => p.status !== "removida" && (p.status === "oculta" || p.reports > 0));
}
