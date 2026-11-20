// Pede ao gateway um código de opt-in de uso único e devolve SÓ o link wa.me (+ validade). A chave do gateway nunca sai do servidor.
// Gera também o token de volta (uso único, 2 h) que vai no link da resposta do bot; o banco guarda só o SHA-256.
// Sessão do convidado (anônima vale); o banco decide se ele é participante não bloqueado e se o recurso está ligado.
import { createOptin } from "../_shared/wa-gateway.ts";
import { handleOptinRequest } from "../_shared/wa-optin.ts";
import { handleHostOptinRequest } from "../_shared/wa-host.ts";
import { adminClient, corsPreflight, corsResponder, logWa, siteOrigin, userClient, waConfig } from "../_shared/wa-runtime.ts";

const FN = "whatsapp-optin";

Deno.serve(async (req) => {
  const json = corsResponder(req);
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  let userId: string | null = null;
  const client = auth.startsWith("Bearer ") ? userClient(auth) : null;
  if (client) {
    const { data, error } = await client.auth.getUser();
    if (!error && data.user) userId = data.user.id;
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: "invalid" }, 400); }

  const cfg = waConfig();
  if (!cfg) { logWa(FN, "sem_configuracao"); return json({ error: "indisponivel" }, 503); }
  const admin = adminClient();

  // anfitrião: opt-in da conta (avisos do evento e do pagamento), subject host.<user_id>
  if (body.scope === "host") {
    try {
      const r = await handleHostOptinRequest({
        userId,
        status: async () => {
          const { data, error } = await client!.rpc("host_whatsapp_status");
          if (error) throw new Error("status");
          return { enabled: (data as { enabled?: boolean } | null)?.enabled === true };
        },
        rateLimit: async (uid) => {
          const { error } = await admin.rpc("check_rate_limit", { p_key: `wa-optin:${uid}`, p_max: 8, p_window: "10 minutes" });
          if (!error) return true;
          if (error.code === "MM006") return false;
          throw new Error("rate");
        },
        siteOrigin: siteOrigin(),
        createOptin: (i) => createOptin(cfg, i),
      });
      logWa(FN, `host:${r.status}`);
      return json(r.body, r.status);
    } catch {
      logWa(FN, "host:erro");
      return json({ error: "indisponivel" }, 503);
    }
  }

  try {
    const r = await handleOptinRequest({ eventId: body.eventId }, {
      userId,
      status: async (eventId) => {
        const { data, error } = await client!.rpc("whatsapp_status", { p_event: eventId });
        if (error) throw Object.assign(new Error("status"), { code: error.code });
        return { enabled: data?.enabled === true, eligible: data?.eligible === true };
      },
      rateLimit: async (uid) => {
        const { error } = await admin.rpc("check_rate_limit", { p_key: `wa-optin:${uid}`, p_max: 8, p_window: "10 minutes" });
        if (!error) return true;
        if (error.code === "MM006") return false;
        throw new Error("rate");
      },
      eventInfo: async (eventId) => {
        const { data } = await admin.from("events").select("code, title").eq("id", eventId).is("deleted_at", null).maybeSingle();
        return typeof data?.code === "string" ? { code: data.code, title: typeof data.title === "string" ? data.title : "" } : null;
      },
      issueReturnToken: async (eventId, uid, tokenHash) => {
        const { error } = await admin.rpc("whatsapp_issue_return_token", { p_event: eventId, p_user: uid, p_hash: tokenHash });
        if (error) throw new Error("token");
      },
      siteOrigin: siteOrigin(),
      createOptin: (i) => createOptin(cfg, i),
    });
    logWa(FN, String(r.status));
    return json(r.body, r.status);
  } catch {
    logWa(FN, "erro");
    return json({ error: "indisponivel" }, 503);
  }
});
