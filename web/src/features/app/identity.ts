import type { Repositories, User } from "@/repositories";

export interface Identity {
  user: User | undefined;
  known: User[];
  /** Pode criar evento: local sempre; na nuvem só quem tem conta (sessão não anônima). */
  canCreate: boolean;
}

/**
 * Quem está usando o app, numa leitura só: pessoa atual + identidades deste aparelho, em paralelo. Na nuvem, o id e o
 * `anonymous` vêm da sessão guardada (sem `auth.getUser()` na rede) e `canCreate` sai do mesmo resultado.
 *
 * Isto decide só o que a INTERFACE mostra (ex.: o botão de criar evento). A segurança não depende daqui: criar evento,
 * ler fotos e todo o resto passam pelo servidor com o JWT da sessão, e a RLS (`auth.uid()`, `is_anonymous()`) recusa
 * quem não pode, seja qual for o valor calculado aqui.
 */
export async function loadIdentity(repos: Repositories, mode: "local" | "supabase"): Promise<Identity> {
  const [user, known] = await Promise.all([repos.users.current(), repos.users.known()]);
  return { user, known, canCreate: mode === "local" || user?.anonymous === false };
}
