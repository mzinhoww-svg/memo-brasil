// Webhook do gateway (puro): valida a assinatura do corpo BRUTO antes de qualquer parse e aplica eventos de opt-in.
// A gravação (RPC whatsapp_apply_event) é idempotente e à prova de ordem, então o gateway pode repetir a entrega (3 tentativas).
import { parseLeadSubject } from "./wa-funnel.ts";
import { parseHostSubject } from "./wa-host.ts";
import { parseSubjectId } from "./wa-optin.ts";
import { verifyWaSignature } from "./wa-signature.ts";

export type ApplyInput = { type: "optin.confirmed" | "optin.revoked"; eventId: string; userId: string; phone: string | null; at: string };
export type ApplyOutcome = "applied" | "stale" | "blocked" | "unknown_subject" | "invalid";
export type ApplyFn = (i: ApplyInput) => Promise<ApplyOutcome>;
/** Opt-in do anfitrião (subject `host.<user_id>`): conta inteira, sem evento. */
export type HostApplyFn = (i: { type: ApplyInput["type"]; userId: string; phone: string | null; at: string }) => Promise<ApplyOutcome>;
/** Lead do funil de quiz (subject `lead.<lead_id>`): só marca o contato confirmado; o telefone não é guardado. */
export type LeadApplyFn = (i: { leadId: string; at: string }) => Promise<ApplyOutcome>;
export type WebhookResult = { status: number; body: Record<string, unknown> };

const MAX_BODY = 65_536;
const PROJECT = "revela";

export async function handleWaWebhook(i: { raw: string; signature: string | null; secret: string; apply: ApplyFn; applyHost?: HostApplyFn; applyLead?: LeadApplyFn }): Promise<WebhookResult> {
  if (!i.secret) return { status: 503, body: { error: "disabled" } };
  if (i.raw.length > MAX_BODY) return { status: 413, body: { error: "invalid" } };
  if (!(await verifyWaSignature(i.raw, i.signature, i.secret))) return { status: 401, body: { error: "unauthorized" } };

  let b: unknown;
  try { b = JSON.parse(i.raw); } catch { return { status: 400, body: { error: "invalid" } }; }
  if (!b || typeof b !== "object" || Array.isArray(b)) return { status: 400, body: { error: "invalid" } };
  const ev = b as Record<string, unknown>;

  if (ev.type !== "optin.confirmed" && ev.type !== "optin.revoked") return { status: 200, body: { ok: true, ignored: "type" } };
  if (ev.project !== PROJECT || ev.instanceId !== PROJECT) return { status: 200, body: { ok: true, ignored: "project" } };
  const subject = parseSubjectId(ev.subjectId);
  const hostSubject = subject ? null : parseHostSubject(ev.subjectId);
  const leadSubject = subject || hostSubject ? null : parseLeadSubject(ev.subjectId);
  if (!subject && !(hostSubject && i.applyHost) && !(leadSubject && i.applyLead)) return { status: 200, body: { ok: true, ignored: "subject" } };

  const at = typeof ev.at === "string" && !Number.isNaN(Date.parse(ev.at)) ? ev.at : null;
  if (!at) return { status: 400, body: { error: "invalid" } };
  let phone: string | null = null;
  if (ev.phone !== undefined && ev.phone !== null) {
    if (typeof ev.phone !== "string") return { status: 400, body: { error: "invalid" } };
    phone = ev.phone.replace(/\D/g, "");
  }
  if (ev.type === "optin.confirmed" && !(phone && /^[0-9]{10,15}$/.test(phone))) return { status: 400, body: { error: "invalid" } };
  if (ev.type === "optin.revoked" && phone !== null && phone !== "" && !/^[0-9]{10,15}$/.test(phone)) phone = null;
  if (phone === "") phone = null;

  // lead do funil: não há opt-in de avisos para desfazer (nada é enviado depois da resposta do bot) e o telefone é descartado
  if (leadSubject && !subject && !(hostSubject && i.applyHost)) {
    if (ev.type !== "optin.confirmed") return { status: 200, body: { ok: true, ignored: "type" } };
    try { return { status: 200, body: { ok: true, outcome: await i.applyLead!({ leadId: leadSubject.leadId, at }) } }; }
    catch { return { status: 500, body: { error: "indisponivel" } }; }
  }

  try {
    const outcome = subject
      ? await i.apply({ type: ev.type, eventId: subject.eventId, userId: subject.userId, phone, at })
      : await i.applyHost!({ type: ev.type, userId: hostSubject!.userId, phone, at });
    return { status: 200, body: { ok: true, outcome } };
  } catch {
    return { status: 500, body: { error: "indisponivel" } };
  }
}
