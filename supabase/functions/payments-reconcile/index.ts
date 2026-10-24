// Conciliação chamada pelo pg_cron (verify_jwt=false; Authorization: Bearer PAYMENTS_CRON_TOKEN). A fila vem do banco
// (payments_reconcile_candidates: teto de idade de 7 dias, limite de lote, ambiente) para ser testável em pgTAP:
// - 'search': pedido criado|pendente|expirado → GET /v1/payments/search?external_reference=<pedido> com paginação limitada
//   (5 páginas de 50). Cada pagamento é aplicado pelo banco; busca incompleta nunca falha o pedido. Pedido 'criado' sem
//   preferência e sem pagamento (busca completa) é falhado por payments_fail_unattached.
// - 'payment': pagamento com reembolso solicitado → GET /v1/payments/{id} e aplica (o 'refunded' chega por aqui se o webhook
//   se perder).
// Antes, payments_expire_stale expira pendentes vencidos. Repetições não regravam payment_events (duplicado). Em 429, espera
// com backoff (até 3 vezes) e encerra o lote se persistir.
import { getPayment, MercadoPagoError } from "../_shared/mercadopago.ts";
import { collectPayments } from "../_shared/mercadopago-flow.ts";
import { applyPayment, expectedCollector, loadOrder, log, mpConfig, responder, sameToken, serviceClient } from "../_shared/payments-runtime.ts";

const FN = "payments-reconcile";
const BATCH = 50;
const BACKOFF_MS = [1_000, 2_000, 4_000];

class StopBatch extends Error {}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof MercadoPagoError) || e.kind !== "rate_limit") throw e;
      if (i >= BACKOFF_MS.length) throw new StopBatch();
      await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    }
  }
}

Deno.serve(async (req) => {
  const json = responder(req, false);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!sameToken(token, Deno.env.get("PAYMENTS_CRON_TOKEN") ?? "")) return json({ error: "unauthorized" }, 401);

  if (!mpConfig("production") && !mpConfig("sandbox")) {
    log(FN, null, null, "pagamento_indisponivel");
    return json({ error: "pagamento_indisponivel" }, 503);
  }
  const admin = serviceClient();
  const exp = await admin.rpc("payments_expire_stale");
  if (exp.error) {
    log(FN, null, null, "erro_banco");
    return json({ error: "db" }, 500);
  }
  const envRes = await admin.rpc("payments_env");
  const envs = envRes.data === "sandbox" || envRes.data === "production" ? [envRes.data as string] : ["sandbox", "production"];
  const queue: Array<{ order_id: string; kind: string; payment_id: string | null }> = [];
  for (const env of envs) {
    const c = await admin.rpc("payments_reconcile_candidates", { p_env: env, p_limit: BATCH });
    if (c.error) {
      log(FN, null, null, "erro_banco");
      return json({ error: "db" }, 500);
    }
    queue.push(...(c.data as typeof queue));
  }
  const seen = new Set<string>(); // um pedido pode aparecer em 'search' e 'payment': tratamos cada (pedido, tipo, pagamento) uma vez
  const work = queue.filter((q) => { const k = `${q.order_id}|${q.kind}|${q.payment_id}`; return !seen.has(k) && !!seen.add(k); }).slice(0, BATCH);

  let verificados = 0, aplicados = 0, falhas = 0, incompletos = 0;
  for (const item of work) {
    try {
      const { order } = await loadOrder(admin, item.order_id);
      if (!order || order.provider !== "mercadopago") continue;
      const cfg = mpConfig(order.provider_env); // credenciais do ambiente DO PEDIDO
      if (!cfg) { falhas++; log(FN, order.id, order.status, "sem_credencial_do_ambiente"); continue; }
      const collector = await withBackoff(() => expectedCollector(cfg));
      if (item.kind === "payment" && item.payment_id) {
        const p = await withBackoff(() => getPayment(cfg, item.payment_id!));
        const r = await applyPayment(admin, order.id, p, collector, "reconcile");
        if (r.applied) aplicados++;
        log(FN, order.id, r.to || order.status, r.outcome);
      } else {
        const { payments, complete } = await withBackoff(() => collectPayments(cfg, order.id, { pageSize: 50, maxPages: 5 }));
        for (const p of payments) {
          const r = await applyPayment(admin, order.id, p, collector, "reconcile");
          if (r.applied) aplicados++;
        }
        if (!complete) incompletos++; // não prova ausência de pagamento: tenta de novo na próxima rodada
        if (payments.length === 0 && complete && order.status === "criado" && !order.mp_preference_id) {
          const f = await admin.rpc("payments_fail_unattached", { p_order: order.id });
          if (f.error) throw new Error("db");
          if (f.data === true) aplicados++;
          log(FN, order.id, f.data === true ? "falhou" : "criado", f.data === true ? "sem_cobranca" : "nao_aplicado");
        } else {
          log(FN, order.id, order.status, complete ? "verificado" : "busca_incompleta");
        }
        const t = await admin.rpc("payments_touch_checked", { p_order: order.id });
        if (t.error) throw new Error("db");
      }
      verificados++;
    } catch (e) {
      falhas++;
      log(FN, item.order_id, null, e instanceof StopBatch ? "limite_provedor" : "falha");
      if (e instanceof StopBatch) break;
    }
  }
  return json({ verificados, aplicados, falhas, incompletos, expirados: exp.data ?? 0 });
});
