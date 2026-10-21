import type { MemoEvent } from "@/domain/event";
import { createIndexedDbRepositories } from "./indexeddb";
import { createMemoryRepositories } from "./memory";
import type { Repositories } from "./types";

export * from "./types";
export { retryOnConflict } from "./mutate";
export { createIndexedDbRepositories, createMemoryRepositories };

/** Persistência local desta fase: IndexedDB; sem IndexedDB cai para memória (dados não persistem). */
export function createLocalRepositories(): { repos: Repositories; persistent: boolean } {
  if (typeof indexedDB === "undefined") return { repos: createMemoryRepositories(), persistent: false };
  return { repos: createIndexedDbRepositories(), persistent: true };
}

/** Remove o evento e tudo que depende dele (fotos, bytes, reações, participantes, convites). */
export async function deleteEventCascade(repos: Repositories, event: Pick<MemoEvent, "id">): Promise<void> {
  await repos.photos.removeByEvent(event.id);
  await repos.reactions.removeByEvent(event.id);
  await repos.participants.removeByEvent(event.id);
  await repos.invitations.removeByEvent(event.id);
  await repos.events.remove(event.id);
}
