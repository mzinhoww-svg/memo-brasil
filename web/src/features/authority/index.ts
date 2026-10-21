import type { MemoEvent } from "@/domain/event";
import type { Repositories } from "@/repositories";
import { reconcileReveal } from "../events/service";

/**
 * Quem faz a revelação acontecer. Local (demo no aparelho): o app espelha o estado, como um cron de bolso.
 * Servidor: a tarefa agendada grava `reveal_status`/`revealed_at`; o cliente só lê, nunca promove sozinho.
 */
export interface RevealAuthority {
  kind: "local" | "server";
  tick(repos: Repositories, eventId: string, now: number): Promise<MemoEvent | undefined>;
}

export const localRevealAuthority: RevealAuthority = { kind: "local", tick: (repos, eventId, now) => reconcileReveal(repos, eventId, now) };

export const serverRevealAuthority: RevealAuthority = { kind: "server", tick: (repos, eventId) => repos.events.get(eventId) };
