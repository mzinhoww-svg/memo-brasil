import type { Repositories } from "@/repositories";

/** Métodos que mudam dados que as telas guardam em cache (evento, fotos, reações, participantes, convites). */
const WRITES: { [G in keyof Repositories]?: string[] } = {
  events: ["save", "remove", "join", "revealNow"],
  participants: ["setBlocked", "put", "remove", "removeByEvent"],
  photos: ["report", "begin", "finalize", "add", "update", "remove", "removeByEvent"],
  reactions: ["put", "remove", "removeByPhoto", "removeByEvent"],
  invitations: ["put", "remove", "removeByEvent"],
};

/**
 * Embrulha os repositórios para avisar `onWrite` depois de cada escrita (deu certo ou não): postar foto, curtir, mudar o
 * evento etc. marcam o cache como velho sem que cada tela precise lembrar. Métodos opcionais ausentes continuam ausentes
 * (o código testa `repos.photos.report`, `repos.events.listMine`...), e as leituras passam direto.
 */
export function withWriteHook(repos: Repositories, onWrite: () => void): Repositories {
  const out = { ...repos };
  for (const group of Object.keys(WRITES) as (keyof Repositories)[]) {
    const src = repos[group] as unknown as Record<string, unknown>;
    const g: Record<string, unknown> = { ...src };
    for (const m of WRITES[group]!) {
      const fn = src[m];
      if (typeof fn !== "function") continue;
      g[m] = (...args: unknown[]) => Promise.resolve().then(() => (fn as (...a: unknown[]) => unknown).apply(src, args)).finally(onWrite);
    }
    (out as Record<string, unknown>)[group] = g;
  }
  return out;
}
