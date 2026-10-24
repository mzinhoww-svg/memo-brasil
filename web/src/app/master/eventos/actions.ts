"use server";
import { revalidatePath } from "next/cache";
import { masterAccess } from "@/lib/master/server";
import { adminErrorText, reasonError } from "../billing";
import { bulkInput, softDeleteRefusal, type ActionResult } from "./lib";

/** Reconfere o acesso (ação é alcançável por POST direto); a autorização final é do banco (`is_master()`). */
async function client() {
  const { access, sb } = await masterAccess();
  return access === "ok" && sb ? sb : null;
}

/** Soft delete (deleted_at) de eventos marcados como teste; o banco recusa o lote se algum não for teste ou tiver pagamento. */
export async function softDeleteTestEvents(ids: string, reason: string): Promise<ActionResult> {
  const sb = await client();
  if (!sb) return { ok: false, error: "Sem permissão para esta ação." };
  const input = bulkInput(ids, reason, reasonError);
  if ("error" in input) return { ok: false, error: input.error };
  const { data, error } = await sb.rpc("admin_soft_delete_test_events", { p_events: input.ids, p_reason: input.reason });
  if (error) return { ok: false, error: softDeleteRefusal(error) ?? adminErrorText(error.code, error.message) };
  revalidatePath("/master", "layout");
  return { ok: true, count: Number((data as { deleted?: number } | null)?.deleted ?? input.ids.length) };
}

/** Marca (`value=true`) ou desmarca eventos como teste, com motivo auditado. */
export async function setTestFlag(ids: string, value: boolean, reason: string): Promise<ActionResult> {
  const sb = await client();
  if (!sb) return { ok: false, error: "Sem permissão para esta ação." };
  const input = bulkInput(ids, reason, reasonError);
  if ("error" in input) return { ok: false, error: input.error };
  const { data, error } = await sb.rpc("admin_set_test_flag", { p_events: input.ids, p_value: value === true, p_reason: input.reason });
  if (error) return { ok: false, error: adminErrorText(error.code, error.message) };
  revalidatePath("/master", "layout");
  return { ok: true, count: Number((data as { updated?: number } | null)?.updated ?? input.ids.length) };
}
