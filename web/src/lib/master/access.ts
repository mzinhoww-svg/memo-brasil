/** Decisão de acesso ao console master. A autoridade é do servidor: claim do JWT E papel ativo no banco (`is_master()`); nada vem de URL, localStorage ou e-mail. */
export type MasterAccess = "local" | "anonymous" | "forbidden" | "ok";

export interface MasterInput {
  backend: "local" | "supabase" | "misconfigured";
  user: { is_anonymous?: boolean; app_metadata?: Record<string, unknown> } | null;
  rpcIsMaster: boolean | null;
}

export function decideMasterAccess(i: MasterInput): MasterAccess {
  if (i.backend !== "supabase") return "local";
  if (!i.user || i.user.is_anonymous) return "anonymous";
  if (i.user.app_metadata?.role !== "master") return "forbidden";
  return i.rpcIsMaster === true ? "ok" : "forbidden";
}
