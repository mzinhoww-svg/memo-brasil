import type { MemoEvent } from "@/domain/event";
import { REACTION_LABEL, type Photo, type Reaction, type ReactionKind } from "@/domain/photo";
import type { ReacaoItem } from "@/revela/screens/FeedReacoes";

const parts = (ts: number, tz: string) => {
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return o;
};

/** Carimbo do print: `'27 03 14 · 22:41` (ano, mês, dia e hora no fuso do evento). */
export function printStamp(ts: number, tz?: string): string {
  const p = parts(ts, tz || "America/Cuiaba");
  return `'${p.year} ${p.month} ${p.day} · ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
/** Só a data do carimbo, sem hora: `'27 03 14`. */
export function printDate(ts: number, tz?: string): string {
  const p = parts(ts, tz || "America/Cuiaba");
  return `'${p.year} ${p.month} ${p.day}`;
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;
export const initialOf = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();
export const photoMoment = (p: Pick<Photo, "capturedAt" | "createdAt">): number => p.capturedAt ?? p.createdAt;

/** "pose 19 de 27": posição da foto entre as do mesmo autor (em ordem de captura) e o rolo do evento. */
export function poseLabel(photo: Photo, all: Photo[], event: Pick<MemoEvent, "shotsPerPerson">): string {
  const mine = all.filter((p) => p.authorId === photo.authorId && p.status !== "removida").sort((a, b) => photoMoment(a) - photoMoment(b) || a.id.localeCompare(b.id));
  const n = Math.max(1, mine.findIndex((p) => p.id === photo.id) + 1);
  return event.shotsPerPerson === null ? `pose ${n}` : `pose ${n} de ${Math.max(event.shotsPerPerson, mine.length)}`;
}

export const likesText = (n: number): string => (n === 0 ? "Nenhuma curtida ainda" : n === 1 ? "1 curtida" : `${n.toLocaleString("pt-BR")} curtidas`);
export const commentsText = (n: number): string => (n === 0 ? "Seja o primeiro a comentar" : n === 1 ? "Ver o comentário" : `Ver os ${n.toLocaleString("pt-BR")} comentários`);

/** As quatro reações do desenho, com a contagem e a minha marcada. */
export function reactionItems(photoId: string, reactions: Reaction[], userId: string): ReacaoItem[] {
  return (Object.keys(REACTION_LABEL) as ReactionKind[]).map((k) => ({
    id: k, label: REACTION_LABEL[k],
    count: reactions.filter((r) => r.photoId === photoId && r.kind === k).length,
    on: reactions.some((r) => r.photoId === photoId && r.authorId === userId && r.kind === k),
  }));
}
