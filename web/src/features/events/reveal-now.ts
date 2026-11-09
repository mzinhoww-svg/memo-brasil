import type { MemoEvent } from "@/domain/event";
import { MIN_REVEAL_LEAD_MS, epochToZoned } from "@/domain/reveal";
import type { Repositories } from "@/repositories";
import { updateReveal, type UpdateRevealResult } from "./service";

/**
 * "Revelar agora" do anfitrião: antecipa a revelação para o próximo minuto cheio com folga (o servidor pede pelo menos 1 minuto à frente),
 * pelo mesmo caminho de "Quando revelar" (`updateReveal`). A tarefa de revelação libera as fotos nesse horário.
 */
export async function revealNow(repos: Repositories, event: MemoEvent, now: number): Promise<UpdateRevealResult> {
  const at = Math.ceil((now + MIN_REVEAL_LEAD_MS + 5_000) / 60_000) * 60_000;
  const z = epochToZoned(at, event.timezone);
  return updateReveal(repos, event.id, { enabled: true, kind: "data", days: 1, date: z.date, time: z.time, timezone: event.timezone }, now);
}
