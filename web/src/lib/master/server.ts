import "server-only";
import { backendStatus } from "@/lib/supabase/env";
import { serverSupabase } from "@/lib/supabase/server";
import { decideMasterAccess, type MasterAccess } from "./access";

/** Resolve o acesso no servidor a cada requisição (getUser valida o JWT no Auth; `is_master()` confere o papel ativo no banco). */
export async function masterAccess(): Promise<{ access: MasterAccess; sb: Awaited<ReturnType<typeof serverSupabase>> | null }> {
  const backend = backendStatus();
  if (backend !== "supabase") return { access: "local", sb: null };
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  const rpc = data.user ? await sb.rpc("is_master") : null;
  const access = decideMasterAccess({ backend, user: data.user, rpcIsMaster: rpc && !rpc.error ? (rpc.data as boolean) : null });
  return { access, sb: access === "ok" ? sb : null };
}
