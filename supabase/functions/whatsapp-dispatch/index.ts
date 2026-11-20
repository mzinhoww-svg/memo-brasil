// Worker de envio, chamado pelo pg_cron a cada minuto (ver supabase/ops/schedule_whatsapp_dispatch.sql). Só o service_role chama.
// Lote pequeno e teto de 55 envios por hora (o gateway limita a 60/h): nunca em loop apertado, nunca para quem saiu.
import { sendMessage } from "../_shared/wa-gateway.ts";
import { runDispatch, type ClaimedItem } from "../_shared/wa-dispatch.ts";
import { buildHostMessage, type HostItem } from "../_shared/wa-host.ts";
import { adminClient, jsonResponse, logWa, sameSecret, siteOrigin, waConfig } from "../_shared/wa-runtime.ts";

const FN = "whatsapp-dispatch";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!sameSecret(token, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")) return jsonResponse({ error: "forbidden" }, 403);
  const cfg = waConfig();
  if (!cfg) { logWa(FN, "sem_configuracao"); return jsonResponse({ error: "indisponivel" }, 503); }
  const admin = adminClient();

  try {
    const report = await runDispatch({
      enabled: async () => {
        const { data } = await admin.from("feature_flags").select("enabled").eq("key", "whatsapp_avisos").maybeSingle();
        return data?.enabled === true;
      },
      claim: async (limit, hourlyCap) => {
        const { data, error } = await admin.rpc("whatsapp_claim_batch", { p_limit: limit, p_hourly_cap: hourlyCap });
        if (error) throw new Error("claim");
        return (data ?? []) as ClaimedItem[];
      },
      send: (i) => sendMessage(cfg, i),
      mark: async (it, status, extra) => {
        const { error } = await admin.rpc("whatsapp_mark", {
          p_event: it.event_id, p_user: it.user_id, p_kind: it.kind, p_status: status,
          p_gateway_id: extra.gatewayId ?? null, p_error: extra.error ?? null, p_retry_in_s: extra.retryInS ?? null,
        });
        if (error) throw new Error("mark");
      },
      revoke: async (it) => {
        await admin.rpc("whatsapp_apply_event", { p_type: "optin.revoked", p_event: it.event_id, p_user: it.user_id, p_phone: null, p_at: new Date().toISOString() });
      },
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      siteOrigin: siteOrigin(),
      batch: 4, hourlyCap: 55, maxAttempts: 5,
    });
    logWa(FN, JSON.stringify(report));
    // avisos ao anfitrião (recuperação de pedido, ativação): mesma flag, mesmo gateway e o mesmo teto por hora (o banco soma as duas filas)
    const host = report.stoppedEarly || report.skipped ? null : await runDispatch<HostItem>({
      enabled: async () => true, // host_claim_batch confere a flag whatsapp_avisos
      claim: async (limit, hourlyCap) => {
        const { data, error } = await admin.rpc("host_claim_batch", { p_limit: limit, p_hourly_cap: hourlyCap });
        if (error) throw new Error("host_claim");
        return (data ?? []) as HostItem[];
      },
      send: (i) => sendMessage(cfg, i),
      mark: async (it, status, extra) => {
        const { error } = await admin.rpc("host_mark", {
          p_id: it.id, p_status: status, p_gateway_id: extra.gatewayId ?? null, p_error: extra.error ?? null, p_retry_in_s: extra.retryInS ?? null,
        });
        if (error) throw new Error("host_mark");
      },
      revoke: async (it) => {
        const { data } = await admin.from("host_outbox").select("user_id").eq("id", it.id).maybeSingle();
        if (data?.user_id) await admin.rpc("host_whatsapp_apply_event", { p_type: "optin.revoked", p_user: data.user_id, p_phone: null, p_at: new Date().toISOString() });
      },
      build: buildHostMessage,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      siteOrigin: siteOrigin(),
      batch: 4, hourlyCap: 55, maxAttempts: 5,
    });
    if (host) logWa(FN, `host:${JSON.stringify(host)}`);
    return jsonResponse({ ok: true, ...report, host });
  } catch {
    logWa(FN, "erro");
    return jsonResponse({ error: "indisponivel" }, 500);
  }
});
