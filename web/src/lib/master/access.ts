/** Decisão de acesso ao console master. A autoridade é do servidor: claim do JWT E papel ativo no banco (`current_platform_role()`); nada vem de URL, localStorage ou e-mail. */
export type PlatformRole = "master" | "support" | "auditor";
/** `ok` = tem papel de plataforma ativo (master, support ou auditor); o que cada papel abre está em `roles.ts`. */
export type MasterAccess = "local" | "anonymous" | "forbidden" | "ok";

export interface MasterInput {
  backend: "local" | "supabase" | "misconfigured";
  user: { is_anonymous?: boolean; app_metadata?: Record<string, unknown> } | null;
  /** Resposta da RPC `current_platform_role()` (null = sem papel ativo ou RPC indisponível). */
  rpcRole: string | null;
}

const ROLES: readonly string[] = ["master", "support", "auditor"];
export const isPlatformRole = (v: unknown): v is PlatformRole => typeof v === "string" && ROLES.includes(v);

export function decideConsoleAccess(i: MasterInput): { access: MasterAccess; role: PlatformRole | null } {
  if (i.backend !== "supabase") return { access: "local", role: null };
  if (!i.user || i.user.is_anonymous) return { access: "anonymous", role: null };
  const claim = i.user.app_metadata?.role;
  // a claim (emitida pelo Auth) E a linha ativa no banco têm de apontar o MESMO papel
  if (isPlatformRole(claim) && i.rpcRole === claim) return { access: "ok", role: claim };
  return { access: "forbidden", role: null };
}

export function decideMasterAccess(i: MasterInput): MasterAccess {
  return decideConsoleAccess(i).access;
}
