import type { MemoEvent } from "@/domain/event";
import { eventStatus } from "@/domain/event";
import type { Repositories } from "@/repositories/types";

export interface MyEvents {
  /** Criados pela pessoa: ativos primeiro, depois encerrados; mais novos primeiro em cada grupo. */
  active: MemoEvent[];
  ended: MemoEvent[];
  /** Festas de outras pessoas em que ela entrou como convidada. */
  joined: MemoEvent[];
}

/**
 * Só eventos da própria pessoa (criados ou em que entrou). Nunca lista eventos de terceiros, nem para o Master:
 * no servidor, `listMine` filtra por `host_id`/participação em vez de baixar tudo o que a RLS permite ver.
 */
export async function loadMyEvents(repos: Repositories, userId: string, now: number): Promise<MyEvents> {
  const all = repos.events.listMine ? await repos.events.listMine(userId) : await repos.events.list();
  const hosted = all.filter((e) => e.hostId === userId).sort((a, b) => b.createdAt - a.createdAt);
  const others = all.filter((e) => e.hostId !== userId);
  const member = await Promise.all(others.map(async (e) => ((await repos.participants.get(e.id, userId)) ? e : undefined)));
  return {
    active: hosted.filter((e) => eventStatus(e, now) === "ativo"),
    ended: hosted.filter((e) => eventStatus(e, now) !== "ativo"),
    joined: (member.filter(Boolean) as MemoEvent[]).sort((a, b) => b.createdAt - a.createdAt),
  };
}
