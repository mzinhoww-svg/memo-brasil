import "server-only";
import { cache } from "react";
import { backendStatus } from "@/lib/supabase/env";
import { serverSupabase } from "@/lib/supabase/server";
import { decideConsoleAccess, type MasterAccess, type PlatformRole } from "./access";

type Sb = Awaited<ReturnType<typeof serverSupabase>>;
export interface MasterSession { access: MasterAccess; role: PlatformRole | null; sb: Sb | null; user: { name: string } | null }

/** Resolve o acesso no servidor a cada requisição (getUser valida o JWT no Auth; `current_platform_role()` confere o papel ativo no banco).
 *  `ok` vale para master, support e auditor; `role` diz qual. `forbidden` = logado sem papel de plataforma. */
export const masterAccess = cache(masterAccessUncached);
async function masterAccessUncached(): Promise<MasterSession> {
  const backend = backendStatus();
  if (backend !== "supabase") return { access: "local", role: null, sb: null, user: null };
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  const rpc = data.user && !data.user.is_anonymous ? await sb.rpc("current_platform_role") : null;
  const decided = decideConsoleAccess({ backend, user: data.user, rpcRole: rpc && !rpc.error && typeof rpc.data === "string" ? rpc.data : null });
  const meta = (data.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = meta.full_name || meta.name || data.user?.email?.split("@")[0] || "Operador";
  return { ...decided, sb: decided.access === "ok" ? sb : null, user: data.user ? { name } : null };
}

/** A chave `printed_album` (álbum impresso). Sem a chave, "Impressões" some do menu e `/master/impressoes*` responde 404. */
export async function printedAlbumOn(sb: NonNullable<MasterSession["sb"]>): Promise<boolean> {
  const { data, error } = await sb.rpc("printed_album_enabled");
  return !error && data === true;
}
