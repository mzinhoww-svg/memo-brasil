"use server";
import { revalidatePath } from "next/cache";
import { masterAccess } from "@/lib/master/server";
import { adminErrorText, reasonError } from "../billing";
import { UUID, type ActionResult } from "../eventos/lib";

/** Executa agora a mesma rotina de revelação do servidor (`admin_reveal_now`), com motivo auditado. */
export async function revealNow(eventId: string, reason: string): Promise<ActionResult> {
  const { access, sb } = await masterAccess();
  if (access !== "ok" || !sb) return { ok: false, error: "Sem permissão para esta ação." };
  if (typeof eventId !== "string" || !UUID.test(eventId)) return { ok: false, error: "Evento inválido." };
  const r = typeof reason === "string" ? reason.trim() : "";
  const e = reasonError(r);
  if (e) return { ok: false, error: e };
  const { error } = await sb.rpc("admin_reveal_now", { p_event: eventId, p_reason: r });
  if (error) {
    if (error.code === "MM008") return { ok: false, error: "Este evento já foi revelado." };
    if (error.code === "MM005") return { ok: false, error: "Evento sem revelação programada ou excluído." };
    return { ok: false, error: adminErrorText(error.code, error.message) };
  }
  revalidatePath("/master", "layout");
  return { ok: true, count: 1 };
}
