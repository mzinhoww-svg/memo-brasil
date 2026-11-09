// Aviso de revelação por e-mail (Brevo). Lógica pura: sem Deno nem Supabase, para ser testada no Node.
export interface RevealEmailRow { id: string; email: string; optout_token: string; event_title: string; event_code: string }
export interface MailConfig { mode: "brevo" | "console"; apiKey?: string; senderEmail: string; senderName: string; appUrl: string; fetchFn?: typeof fetch; log?: (line: string) => void }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** O link do feed e o de descadastro nunca carregam dados pessoais além do código do evento e do token imprevisível. */
export function buildRevealEmail(row: RevealEmailRow, appUrl: string): { subject: string; html: string; text: string; feedUrl: string; optOutUrl: string } {
  const base = appUrl.replace(/\/+$/, "");
  const feedUrl = `${base}/e/${encodeURIComponent(row.event_code)}`;
  const optOutUrl = `${base}/email/sair?t=${encodeURIComponent(row.optout_token)}`;
  const title = row.event_title;
  const subject = `Revelou. As fotos de ${title} já estão no ar`;
  const text = [
    `Revelou. As fotos de ${title} já estão no ar.`,
    `Abra o feed da festa: ${feedUrl}`,
    "",
    "Você recebeu este aviso porque pediu para ser avisado quando a festa revelasse. É o único e-mail que enviamos sobre ela.",
    `Não quer mais receber? ${optOutUrl}`,
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#0E0C0B;color:#F6EFE6;font-family:system-ui,sans-serif">
<h1 style="font:400 28px Georgia,serif;margin:0 0 12px">Revelou.</h1>
<p style="font-size:16px;line-height:24px">As fotos de <strong>${esc(title)}</strong> já estão no ar.</p>
<p><a href="${esc(feedUrl)}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#FF4D1F;color:#1A0700;font-weight:700;text-decoration:none">Abrir o feed da festa</a></p>
<p style="font-size:13px;line-height:18px;color:#B5AA9F">Você recebeu este aviso porque pediu para ser avisado quando a festa revelasse. É o único e-mail que enviamos sobre ela.<br><a href="${esc(optOutUrl)}" style="color:#FF8A5E">Não quero mais receber</a></p>
</body></html>`;
  return { subject, html, text, feedUrl, optOutUrl };
}

/** Envia um aviso. `console`: só registra (sandbox/desenvolvimento). `brevo`: POST /v3/smtp/email. Devolve null se enviou, ou o motivo da falha. */
export async function sendRevealEmail(row: RevealEmailRow, cfg: MailConfig): Promise<string | null> {
  const mail = buildRevealEmail(row, cfg.appUrl);
  if (cfg.mode === "console") {
    (cfg.log ?? console.log)(`[reveal-email:console] para=${row.email} assunto="${mail.subject}" feed=${mail.feedUrl} sair=${mail.optOutUrl}`);
    return null;
  }
  if (!cfg.apiKey) return "brevo_sem_chave";
  const res = await (cfg.fetchFn ?? fetch)("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cfg.apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: cfg.senderEmail, name: cfg.senderName },
      to: [{ email: row.email }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      headers: { "List-Unsubscribe": `<${mail.optOutUrl}>` },
    }),
  });
  if (res.ok) return null;
  return `brevo_${res.status}`;
}

/** Processa um lote: cada linha é enviada no máximo uma vez (mark_sent só vale com sent_at nulo). */
export async function processBatch(rows: RevealEmailRow[], cfg: MailConfig, io: { markSent: (id: string) => Promise<boolean>; markFailed: (id: string, reason: string) => Promise<void> }) {
  let sent = 0, failed = 0, skipped = 0;
  for (const row of rows) {
    try {
      const err = await sendRevealEmail(row, cfg);
      if (err) { failed++; await io.markFailed(row.id, err); continue; }
      if (await io.markSent(row.id)) sent++; else skipped++;
    } catch (e) {
      failed++;
      await io.markFailed(row.id, e instanceof Error ? e.message : "erro");
    }
  }
  return { sent, failed, skipped };
}
