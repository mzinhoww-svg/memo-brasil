// Estado do pedido para o anfitrião (polling da tela do Pix). Igual a payments_order_status; se o pedido está 'pendente'
// e a última consulta tem mais de 15 s, reconsulta o provedor antes (o webhook continua sendo o caminho principal).
import { applyStatus, caller, guardEnv, loadOrder, log, preflight, recheck, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

const FN = "payments-status";
const RECHECK_AFTER_MS = 15_000;

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const who = await caller(req);
  if (!who.ok) return json({ error: who.status === 401 ? "unauthorized" : "forbidden" }, who.status);

  let orderId = "";
  try {
    orderId = String(((await req.json()) as Record<string, unknown>).orderId ?? "");
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (!UUID_RE.test(orderId)) return json({ error: "invalid" }, 400);

  const admin = serviceClient();
  const provider = await guardEnv(admin);
  if (!provider) return json({ error: "pagamento_indisponivel" }, 503);

  const read = () => who.client.rpc("payments_order_status", { p_order: orderId });
  let st = await read();
  if (st.error) {
    if (st.error.code === "MM004") return json({ error: "nao_encontrado" }, 404);
    return json({ error: "indisponivel" }, 500);
  }

  if ((st.data as { status?: string }).status === "pendente") {
    const { order } = await loadOrder(admin, orderId);
    const stale = !order?.last_checked_at || Date.now() - Date.parse(order.last_checked_at) > RECHECK_AFTER_MS;
    if (order && stale && order.provider_charge_id && order.provider_env === provider.env) {
      try {
        const state = await recheck(provider.config, order.provider_charge_id);
        const r = await applyStatus(admin, order, order.provider_charge_id, state, state.devMode, "status");
        log(FN, orderId, r.to, r.applied ? "aplicado" : "nao_aplicado");
        if (r.applied) st = await read();
      } catch {
        log(FN, orderId, "pendente", "reconsulta_falhou"); // devolve o estado atual; o webhook/reconciliação corrigem depois
      }
    }
  }
  if (st.error) return json({ error: "indisponivel" }, 500);
  return json(st.data);
});
