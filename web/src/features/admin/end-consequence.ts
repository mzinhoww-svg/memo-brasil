import type { MemoEvent } from '@/domain/event';
import { computeRevealStatus, formatInZone, syncRevealWithEnd } from '@/domain/reveal';

/** Usa o mesmo recálculo do serviço antes de confirmar a mudança de fim. */
export function endConsequence(event: MemoEvent, newEnd: number, now: number): string {
  const next = syncRevealWithEnd({ ...event, endedAt: newEnd, durationHours: Math.max(event.durationHours, (newEnd - event.startAt) / 3_600_000) }, now);
  if (!event.revealEnabled) return 'As fotos continuam disponíveis na hora para as pessoas autorizadas.';
  const audience = event.everyoneSeesAll ? 'Quem está na festa poderá ver as fotos.' : 'Somente o autor e o anfitrião poderão ver cada foto; os outros convidados não veem.';
  if (computeRevealStatus(event, now) === 'revelada') return `As fotos já foram reveladas. ${audience}`;
  if (next.revealAt !== null && next.revealAt <= now) return `As fotos serão reveladas agora. ${audience} Depois de revelar, não é possível escondê-las novamente.`;
  if (next.revealAt === null) return `A revelação ainda não tem data definida. ${audience}`;
  const at = formatInZone(next.revealAt, event.timezone);
  return `As fotos serão reveladas em ${at.date}, ${at.time} (${event.timezone}). ${audience}`;
}
