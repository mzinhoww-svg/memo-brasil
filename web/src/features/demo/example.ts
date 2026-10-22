import type { MemoEvent } from "@/domain/event";
import { createMemoryRepositories, type Repositories, type User } from "@/repositories";
import { seedDemoEvent } from "./seed";

/** Quantas fotos a pessoa pode tirar na festa de exemplo. */
export const EXAMPLE_SHOTS = 5;

export interface ExampleParty {
  repos: Repositories;
  host: User;
  event: MemoEvent;
  shotsLimit: number;
}

/**
 * Festa de exemplo da rota pública `/exemplo`: vive só em memória (nunca o adaptador ativo, nem com backend=supabase)
 * e some quando a página é fechada. Nada é gravado no navegador nem no servidor.
 */
export async function createExampleParty(now: number): Promise<ExampleParty> {
  const repos = createMemoryRepositories();
  const host: User = { id: crypto.randomUUID(), name: "Lu", createdAt: now };
  await repos.users.save(host);
  const event = await seedDemoEvent(repos, host, now, { title: "Lu faz 40", shotsPerPerson: EXAMPLE_SHOTS });
  return { repos, host, event, shotsLimit: EXAMPLE_SHOTS };
}
