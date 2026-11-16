/** Eventos de teste (M21 e M22): marcar, desmarcar e excluir em lote. O servidor decide (só master; evento pago ou real recusa o lote INTEIRO) e devolve
 *  o motivo de cada evento recusado no `details` do erro (JSON). Aqui só se chama e se traduz a resposta. */
import { browserSupabase } from "@/lib/supabase/client";

export interface Refusal { id: string; title: string | null; code: "missing" | "nottest" | "paid" | string; reason: string }
export type TestOutcome =
  | { ok: true; count: number }
  | { ok: false; kind: "refused"; refusals: Refusal[] }
  | { ok: false; kind: "forbidden" | "reason" | "invalid" | "unknown" };

/** `details` do erro da RPC (JSON com um item por evento recusado) → lista. Texto que não é a lista esperada devolve []. */
export function parseRefusals(details: unknown): Refusal[] {
  if (typeof details !== "string" || !details.trim().startsWith("[")) return [];
  try {
    const raw = JSON.parse(details) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r) => {
      const o = r as Partial<Refusal> | null;
      return o && typeof o.id === "string" && typeof o.reason === "string" ? [{ id: o.id, title: typeof o.title === "string" ? o.title : null, code: String(o.code ?? ""), reason: o.reason }] : [];
    });
  } catch { return []; }
}

export function outcomeOfError(error: { code?: string; message?: string; details?: string | null }): TestOutcome {
  const msg = error.message ?? "";
  if (error.code === "MM004" || /forbidden/.test(msg)) return { ok: false, kind: "forbidden" };
  if (error.code === "MM011" || /reasonrequired/.test(msg)) return { ok: false, kind: "reason" };
  if (error.code === "MM005") {
    const refusals = parseRefusals(error.details);
    return refusals.length ? { ok: false, kind: "refused", refusals } : { ok: false, kind: "invalid" };
  }
  return { ok: false, kind: "unknown" };
}

export const TEST_ERROR_TEXT: Record<"forbidden" | "reason" | "invalid" | "unknown", string> = {
  forbidden: "Sem permissão. Só o master marca, desmarca e exclui eventos de teste.",
  reason: "Escreva o motivo com 10 a 500 caracteres.",
  invalid: "O servidor recusou: confira se os eventos ainda existem.",
  unknown: "Não foi possível concluir agora. Tente de novo.",
};

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string; details?: string | null } | null }>;
const defaultRpc: Rpc = (fn, args) => browserSupabase().rpc(fn, args);

export async function setTestFlag(ids: string[], value: boolean, reason: string, rpc: Rpc = defaultRpc): Promise<TestOutcome> {
  const { data, error } = await rpc("admin_set_test_flag", { p_events: ids, p_value: value, p_reason: reason });
  return error ? outcomeOfError(error) : { ok: true, count: Number((data as { updated?: number } | null)?.updated ?? ids.length) };
}
export async function deleteTestEvents(ids: string[], reason: string, rpc: Rpc = defaultRpc): Promise<TestOutcome> {
  const { data, error } = await rpc("admin_soft_delete_test_events", { p_events: ids, p_reason: reason });
  return error ? outcomeOfError(error) : { ok: true, count: Number((data as { deleted?: number } | null)?.deleted ?? ids.length) };
}

/** "Este evento tem pagamento confirmado em produção." a partir do motivo do servidor ("Tem pagamento confirmado em produção"). */
export function refusalSentence(reason: string): string {
  return /^Tem /.test(reason) ? `Este evento ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.` : /[.!?]$/.test(reason) ? reason : `${reason}.`;
}
