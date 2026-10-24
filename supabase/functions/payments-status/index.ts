// Estado do pedido para o anfitrião (página de retorno e polling). Igual a payments_order_status; se o pedido ainda não está
// pago e a última consulta tem mais de 15 s, reconsulta o provedor (GET /v1/payments/search?external_reference=) e aplica
// cada pagamento pelo banco antes de responder. O retorno do checkout e os parâmetros da URL são só dicas de UX: o estado
// verdadeiro é este. O webhook continua sendo o caminho principal.
import { collectPayments } from "../_shared/mercadopago-flow.ts";
import { applyPayment, caller, expectedCollector, loadOrder, log, mpConfig, preflight, responder, serviceClient, UUID_RE } from "../_shared/payments-runtime.ts";

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

  const read = () => who.client.rpc("payments_order_status", { p_order: orderId });
  let st = await read();
  if (st.error) {
    if (st.error.code === "MM004") return json({ error: "nao_encontrado" }, 404);
    return json({ error: "indisponivel" }, 500);
  }

  const cur = (st.data as { status?: string; provider?: string }) ?? {};
  if (cur.provider === "mercadopago" && ["criado", "pendente", "expirado"].includes(String(cur.status))) {
    const cfg = mpConfig();
    const admin = serviceClient();
    const { order } = await loadOrder(admin, orderId);
    const stale = !order?.last_checked_at || Date.now() - Date.parse(order.last_checked_at) > RECHECK_AFTER_MS;
    if (cfg && order && stale) {
      try {
        const collector = await expectedCollector(cfg);
        const { payments } = await collectPayments(cfg, order.id, { pageSize: 50, maxPages: 2 });
        let applied = false;
        for (const p of payments) {
          const r = await applyPayment(admin, order.id, p, collector, "status");
          applied ||= r.applied;
        }
        await admin.rpc("payments_touch_checked", { p_order: order.id });
        log(FN, orderId, cur.status ?? null, applied ? "aplicado" : "nao_aplicado");
        if (applied) st = await read();
      } catch {
        log(FN, orderId, cur.status ?? null, "reconsulta_falhou"); // devolve o estado atual; o webhook/reconciliação corrigem depois
      }
    }
  }
  if (st.error) return json({ error: "indisponivel" }, 500);
  return json(st.data);
});
