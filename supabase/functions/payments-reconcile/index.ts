// Conciliação chamada pelo pg_cron (verify_jwt=false; Authorization: Bearer PAYMENTS_CRON_TOKEN). Lote de até 50 pedidos:
// - 'pendente' criado há > 60 s e consultado há > 60 s → reconsulta e aplica (webhook perdido, vencimento);
// - 'pago' (ou pedido ainda não pago com needs_refund: Ruling 16 e PAID divergente) com reembolso solicitado → reconsulta
//   (o 'estornado' chega por aqui se o webhook se perder);
// - 'criado' sem cobrança há > 5 min → procura a cobrança na listagem (create que deu timeout), paginando só com parâmetros
//   documentados (startDate, after, limit). Só adota com externalId === id do pedido, mesmo valor e mesmo devMode;
//   sem correspondência exata depois de ver a lista inteira: 'falhou' (libera novo checkout). Busca incompleta (cursor
//   parado ou limite de 10 páginas): não falha, tenta de novo na próxima rodada (unattachedAction).
// Inclui pedidos de evento purgado (event_id null). Só trata pedidos do ambiente da chave configurada.
// Em 429 espera com backoff exponencial (até 3 vezes) e encerra o lote se persistir.
import {
  AbacateError, applyStatus, findChargeForOrder, log, ORDER_COLUMNS, type OrderRow, providerConfig, recheck, responder, sameToken, serviceClient,
  unattachedAction,
} from "../_shared/payments-runtime.ts";

const FN = "payments-reconcile";
const BATCH = 50;
const BACKOFF_MS = [1_000, 2_000, 4_000];

class StopBatch extends Error {}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof AbacateError) || e.kind !== "rate_limit") throw e;
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

  const provider = providerConfig();
  if (!provider) {
    log(FN, null, null, "pagamento_indisponivel");
    return json({ error: "pagamento_indisponivel" }, 503);
  }
  const admin = serviceClient();
  const minute = new Date(Date.now() - 60_000).toISOString();
  const fiveMin = new Date(Date.now() - 5 * 60_000).toISOString();

  const [pend, paid, created] = await Promise.all([
    admin.from("payment_orders").select(ORDER_COLUMNS).eq("status", "pendente").eq("provider_env", provider.env)
      .not("provider_charge_id", "is", null).lt("created_at", minute).or(`last_checked_at.is.null,last_checked_at.lt.${minute}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(BATCH),
    // reembolso solicitado: 'pago' ou pedido ainda não pago com needs_refund (admin_request_refund só aceita esses)
    admin.from("payment_orders").select(ORDER_COLUMNS).in("status", ["pago", "pendente", "expirado", "cancelado", "falhou"])
      .eq("provider_env", provider.env)
      .not("refund_requested_at", "is", null).not("provider_charge_id", "is", null)
      .or(`last_checked_at.is.null,last_checked_at.lt.${minute}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(BATCH),
    admin.from("payment_orders").select(ORDER_COLUMNS).eq("status", "criado").eq("provider_env", provider.env)
      .is("provider_charge_id", null).lt("created_at", fiveMin).order("created_at").limit(BATCH),
  ]);
  if (pend.error || paid.error || created.error) {
    log(FN, null, null, "erro_banco");
    return json({ error: "db" }, 500);
  }
  const seen = new Set<string>(); // pendente com reembolso solicitado aparece em dois grupos: uma reconsulta só
  const queue = [
    ...((pend.data ?? []) as OrderRow[]),
    ...((paid.data ?? []) as OrderRow[]),
    ...((created.data ?? []) as OrderRow[]),
  ].filter((o) => !seen.has(o.id) && !!seen.add(o.id)).slice(0, BATCH);

  let verificados = 0, aplicados = 0, falhas = 0;
  for (const order of queue) {
    try {
      if (order.status === "criado") {
        const search = await findChargeForOrder(provider.config, order, withBackoff);
        const action = unattachedAction(search);
        if (action === "tentar_depois") {
          // busca incompleta não prova que a cobrança não existe: não falha o pedido, tenta na próxima rodada
          verificados++;
          log(FN, order.id, "criado", "busca_incompleta");
          continue;
        }
        if (action === "falhar") {
          const f = await admin.rpc("payments_fail_unattached", { p_order: order.id });
          if (f.error) throw new Error("db");
          verificados++;
          if (f.data === true) aplicados++;
          log(FN, order.id, f.data === true ? "falhou" : "criado", f.data === true ? "sem_cobranca" : "nao_aplicado");
          continue;
        }
        const found = search.charge!;
        const a = await admin.rpc("payments_attach_charge", {
          p_order: order.id, p_charge_id: found.id, p_brcode: found.brCode ?? null, p_brcode_base64: found.brCodeBase64 ?? null,
          p_expires_at: found.expiresAt ?? null, p_dev_mode: found.devMode,
        });
        if (a.error) throw new Error("db"); // inclusive 23505 (cobrança já ligada a outro pedido): nunca é sucesso
        order.provider_charge_id = found.id;
        order.status = "pendente";
        log(FN, order.id, "pendente", "cobranca_adotada");
      }
      const chargeId = order.provider_charge_id!;
      const state = await withBackoff(() => recheck(provider.config, chargeId));
      const r = await applyStatus(admin, order, chargeId, state, state.devMode, "reconcile");
      verificados++;
      if (r.applied) aplicados++;
      log(FN, order.id, r.to, r.applied ? "aplicado" : "nao_aplicado");
    } catch (e) {
      falhas++;
      log(FN, order.id, order.status, e instanceof StopBatch ? "limite_provedor" : "falha");
      if (e instanceof StopBatch) break;
    }
  }
  return json({ verificados, aplicados, falhas });
});
