import type { MemoEvent } from "@/domain/event";
import { eventStatus } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import type { EventPreview, PhotoCounts } from "./types";

export function toPreview(e: MemoEvent, now: number, participantCount: number): EventPreview {
  return {
    code: e.code, title: e.title, category: e.category, hostName: e.hostName, startAt: e.startAt, place: e.place, palette: e.palette, eventFont: e.eventFont, ...(e.theme ? { theme: e.theme } : {}),
    capacity: e.capacity, status: eventStatus(e, now), full: e.capacity !== null && participantCount >= e.capacity,
  };
}

/** Contagem local: o convidado não deve nem saber quantas fotos foram moderadas (só as visíveis entram no total dele). */
export function localCounts(photos: Photo[], who: { userId: string | null; host: boolean }): PhotoCounts {
  return {
    mine: who.userId ? photos.filter((p) => p.authorId === who.userId && p.status !== "removida").length : 0,
    total: photos.filter((p) => (who.host ? p.status !== "removida" : p.status === "visivel")).length,
  };
}
