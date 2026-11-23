// Funil de quiz: cria o lead (sem dado pessoal) e devolve o link do WhatsApp cuja resposta automática do bot é o texto da oferta.
// Aberta a visitantes sem conta: publicar com --no-verify-jwt (config.toml: verify_jwt = false). Limite por IP (só o hash vira chave).
// A chave do gateway nunca sai do servidor; o front recebe só {leadId, expiresAt, waLink}.
import { createOptin } from "../_shared/wa-gateway.ts";
import { handleFunnelLead } from "../_shared/wa-funnel.ts";
import { adminClient, corsPreflight, corsResponder, logWa, siteOrigin, waConfig } from "../_shared/wa-runtime.ts";

const FN = "funnel-lead";
const OFFER_MINUTES = 30; // igual ao padrão de funnel_leads.offer_expires_at

async function ipKey(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "0";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`funil|${ip}`));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const json = corsResponder(req);
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 2048) return json({ error: "invalid" }, 400);
    body = JSON.parse(raw);
  } catch { return json({ error: "invalid" }, 400); }

  const admin = adminClient();
  const cfg = waConfig();
  try {
    const key = await ipKey(req);
    const r = await handleFunnelLead(body, {
      rateLimit: async () => {
        const { error } = await admin.rpc("check_rate_limit", { p_key: `funil-lead:${key}`, p_max: 8, p_window: "1 hour" });
        if (!error) return true;
        if (error.code === "MM006") return false;
        throw new Error("rate");
      },
      createLead: async (i) => {
        const { data, error } = await admin.rpc("funnel_lead_create", { p_quiz: i.quiz, p_profile: i.profile, p_guests: i.guests, p_source: i.source, p_medium: i.medium, p_campaign: i.campaign });
        const d = data as { leadId?: unknown; expiresAt?: unknown } | null;
        if (error || typeof d?.leadId !== "string" || typeof d.expiresAt !== "string") throw new Error("lead");
        return { leadId: d.leadId, expiresAt: d.expiresAt };
      },
      terms: async () => {
        const { data, error } = await admin.from("plans").select("price_cents, max_guests").eq("code", "ate50").maybeSingle();
        if (error || !data || typeof data.price_cents !== "number" || typeof data.max_guests !== "number") throw new Error("terms");
        return { priceCents: data.price_cents, maxGuests: data.max_guests, minutes: OFFER_MINUTES };
      },
      siteOrigin: siteOrigin(),
      createOptin: cfg ? (i) => createOptin(cfg, i) : null,
    });
    logWa(FN, `${r.status}${r.status === 200 ? (r.body.waLink ? ":wa" : ":sem_wa") : ""}`);
    return json(r.body, r.status);
  } catch {
    logWa(FN, "erro");
    return json({ error: "indisponivel" }, 503);
  }
});
