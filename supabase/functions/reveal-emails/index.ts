import { processBatch, type RevealEmailRow } from "../_shared/reveal-email.ts";
import { responder, sameToken, serviceClient } from "../_shared/payments-runtime.ts";

// Chamada por pg_cron/agendador com Authorization: Bearer REVEAL_EMAILS_TOKEN.
// REVEAL_EMAIL_MODE=console (padrão) só registra no console; =brevo envia de verdade (exige BREVO_API_KEY).
Deno.serve(async (req) => {
  const json = responder(req, false);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const expected = Deno.env.get("REVEAL_EMAILS_TOKEN") ?? "";
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!expected || !sameToken(expected, provided)) return json({ error: "unauthorized" }, 401);
  const mode = Deno.env.get("REVEAL_EMAIL_MODE") === "brevo" ? "brevo" : "console";
  const admin = serviceClient();
  const claimed = await admin.rpc("claim_reveal_emails", { p_limit: 50 });
  if (claimed.error) return json({ error: "indisponivel" }, 503);
  const result = await processBatch((claimed.data ?? []) as RevealEmailRow[], {
    mode,
    apiKey: Deno.env.get("BREVO_API_KEY") ?? undefined,
    senderEmail: Deno.env.get("REVEAL_EMAIL_SENDER") ?? "avisos@revela.app",
    senderName: "Revela",
    appUrl: Deno.env.get("APP_URL") ?? "https://newmemocuiaba.vercel.app",
  }, {
    markSent: async (id) => (await admin.rpc("mark_reveal_email_sent", { p_id: id })).data === true,
    markFailed: async (id, reason) => { await admin.rpc("mark_reveal_email_failed", { p_id: id, p_error: reason }); },
  });
  return json({ mode, ...result });
});
