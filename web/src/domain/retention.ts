import { endAt, type MemoEvent } from "./event";

/** Política 2026-10-22-v1: fotos disponíveis por 90 dias após o encerramento do evento. O servidor aplica (can_see_photo / expire_retained_events); aqui só se informa. */
export const RETENTION_DAYS = 90;

/** Fim da disponibilidade das fotos; null para evento criado antes da política (sem prazo automático). */
export function photosAvailableUntil(e: Pick<MemoEvent, "startAt" | "durationHours" | "endedAt" | "retentionPolicy">): number | null {
  return e.retentionPolicy ? endAt(e) + RETENTION_DAYS * 86_400_000 : null;
}
