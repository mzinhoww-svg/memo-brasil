// Webhook do gateway. Publicar com --no-verify-jwt (config.toml: verify_jwt = false): o gateway não manda JWT; a autenticação é a
// assinatura HMAC do corpo bruto (x-wa-signature), conferida ANTES de qualquer parse. Idempotente: o gateway repete a entrega.
import { handleWaWebhook } from "../_shared/wa-webhook.ts";
import { adminClient, jsonResponse, logWa } from "../_shared/wa-runtime.ts";

const FN = "whatsapp-webhook";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method" }, 405);
  const raw = await req.text();
  const admin = adminClient();
  const r = await handleWaWebhook({
    raw,
    signature: req.headers.get("x-wa-signature"),
    secret: Deno.env.get("WA_GATEWAY_WEBHOOK_SECRET") ?? "",
    apply: async (i) => {
      const { data, error } = await admin.rpc("whatsapp_apply_event", { p_type: i.type, p_event: i.eventId, p_user: i.userId, p_phone: i.phone, p_at: i.at });
      if (error) {
        if (error.code === "MM005") return "invalid";
        throw new Error("apply");
      }
      return data as "applied" | "stale" | "blocked" | "unknown_subject";
    },
    applyHost: async (i) => {
      const { data, error } = await admin.rpc("host_whatsapp_apply_event", { p_type: i.type, p_user: i.userId, p_phone: i.phone, p_at: i.at });
      if (error) {
        if (error.code === "MM005") return "invalid";
        throw new Error("apply_host");
      }
      return data as "applied" | "stale" | "unknown_subject";
    },
    applyLead: async (i) => {
      const { data, error } = await admin.rpc("funnel_lead_confirm", { p_lead: i.leadId, p_at: i.at });
      if (error) throw new Error("apply_lead");
      return data as "applied" | "stale" | "unknown_subject";
    },
  });
  logWa(FN, `${r.status}:${String(r.body.outcome ?? r.body.ignored ?? r.body.error ?? "ok")}`);
  return jsonResponse(r.body, r.status);
});
