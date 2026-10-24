"use server";

import { revalidatePath } from "next/cache";
import { masterAccess } from "@/lib/master/server";
import { adminErrorText, reasonError } from "../billing";
import { isEditableKey, validateSetting } from "./validate";

export type SaveState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; field?: "value" | "reason"; message: string };

/**
 * Grava um campo do "Cadastro da empresa" por `admin_set_setting(p_key, p_value jsonb, p_reason)`.
 * Revalida a chave, o valor e o motivo no servidor; `payments_env` e qualquer chave fora da lista são recusados antes do banco.
 */
export async function saveCompanySetting(_prev: SaveState, form: FormData): Promise<SaveState> {
  const key = form.get("key");
  if (!isEditableKey(key)) return { status: "error", message: "Este campo não pode ser alterado aqui." };
  const checked = validateSetting(key, String(form.get("value") ?? ""));
  if (!checked.ok) return { status: "error", field: "value", message: checked.error };
  const reason = String(form.get("reason") ?? "");
  const rErr = reasonError(reason);
  if (rErr) return { status: "error", field: "reason", message: rErr };

  const { access, sb } = await masterAccess();
  if (access !== "ok" || !sb) return { status: "error", message: "Sem permissão para esta ação." };
  const { error } = await sb.rpc("admin_set_setting", { p_key: key, p_value: checked.value, p_reason: reason.trim() });
  if (error) return { status: "error", message: adminErrorText(error.code, error.message) };

  revalidatePath("/master", "layout"); // atualiza a barra de alertas e o badge de Configurações
  return { status: "ok", message: "Salvo e registrado na auditoria." };
}
