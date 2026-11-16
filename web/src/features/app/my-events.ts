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
  let all: MemoEvent[];
  let joined: MemoEvent[];
  if (repos.events.listMine) {
    // o servidor já devolve só os eventos criados ou em que a pessoa entrou: não há por que conferir participação de novo
    all = await repos.events.listMine(userId);
    joined = all.filter((e) => e.hostId !== userId);
  } else {
    all = await repos.events.list();
    const others = all.filter((e) => e.hostId !== userId);
    joined = (await Promise.all(others.map(async (e) => ((await repos.participants.get(e.id, userId)) ? e : undefined)))).filter(Boolean) as MemoEvent[];
  }
  const hosted = all.filter((e) => e.hostId === userId).sort((a, b) => b.createdAt - a.createdAt);
  return {
    active: hosted.filter((e) => eventStatus(e, now) === "ativo"),
    ended: hosted.filter((e) => eventStatus(e, now) !== "ativo"),
    joined: joined.sort((a, b) => b.createdAt - a.createdAt),
  };
}
