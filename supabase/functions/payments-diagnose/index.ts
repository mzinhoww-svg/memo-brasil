// Diagnóstico não financeiro do Mercado Pago (verify_jwt=true; só Master). Chama GET /users/me e
// GET /checkout/preferences/search?limit=1 e devolve APENAS metadados não secretos: id da conta recebedora, site/país,
// existência de permissão, testUser (tag da API: true/false/null), se os segredos existem (booleanos) e o ambiente do banco. Nunca devolve token, segredo ou corpo.
// Nenhuma cobrança, preferência ou reembolso é criado.
import { getMe, MercadoPagoError, searchPreferences } from "../_shared/mercadopago.ts";
import { caller, mpConfig, preflight, responder, serviceClient } from "../_shared/payments-runtime.ts";

const failure = (e: unknown) => (e instanceof MercadoPagoError ? { ok: false, kind: e.kind, status: e.status } : { ok: false, kind: "erro" });

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const who = await caller(req);
  if (!who.ok) return json({ error: who.status === 401 ? "unauthorized" : "forbidden" }, who.status);
  const m = await who.client.rpc("is_master");
  if (m.error || m.data !== true) return json({ error: "forbidden" }, 403);

  const env = await serviceClient().rpc("payments_env");
  const base = {
    paymentsEnv: env.data ?? null,
    secrets: {
      MERCADOPAGO_ACCESS_TOKEN: !!Deno.env.get("MERCADOPAGO_ACCESS_TOKEN"),
      MERCADOPAGO_WEBHOOK_SECRET: !!Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET"),
      PAYMENTS_CRON_TOKEN: !!Deno.env.get("PAYMENTS_CRON_TOKEN"),
      MERCADOPAGO_ACCESS_TOKEN_SANDBOX: !!Deno.env.get("MERCADOPAGO_ACCESS_TOKEN_SANDBOX"),
      MERCADOPAGO_WEBHOOK_SECRET_SANDBOX: !!Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET_SANDBOX"),
    },
    webhookUrl: Deno.env.get("PAYMENTS_WEBHOOK_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/payments-webhook`,
  };
  const probe = async (env: "production" | "sandbox") => {
    const cfg = mpConfig(env);
    if (!cfg) return { configured: false };
    const [me, prefs] = await Promise.all([
      getMe(cfg).then((r) => ({ ok: true, accountId: r.id, siteId: r.siteId, countryId: r.countryId, testUser: r.testUser }), failure),
      searchPreferences(cfg, 1).then((r) => ({ ok: true, total: r.total }), failure),
    ]);
    return { configured: true, ok: me.ok && prefs.ok, account: me, preferencesSearch: prefs };
  };
  const [production, sandbox] = await Promise.all([probe("production"), probe("sandbox")]);
  if (!production.configured && !sandbox.configured) return json({ ...base, ok: false, error: "token_ausente_ou_url_invalida" });
  // `account`/`preferencesSearch` (nível raiz) = produção, por compatibilidade com o formato anterior.
  return json({ ...base, ok: production.configured ? !!production.ok : false, account: (production as { account?: unknown }).account ?? null, preferencesSearch: (production as { preferencesSearch?: unknown }).preferencesSearch ?? null, production, sandbox });
});
