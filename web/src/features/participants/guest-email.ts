import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * E-mail opcional do convidado (20b): só serve para o aviso de revelação. Informar o e-mail com a finalidade
 * escrita ao lado é o consentimento; sair da lista vale pelo link do próprio e-mail. Sem servidor, não há aviso.
 * Falha aqui nunca impede a entrada na festa.
 */
export async function saveGuestEmail(eventId: string, email: string): Promise<boolean> {
  const e = email.trim();
  if (!e || !EMAIL_RE.test(e) || backendMode() !== "supabase") return false;
  try {
    const { error } = await browserSupabase().rpc("set_my_email", { p_event: eventId, p_email: e, p_consent: true });
    return !error;
  } catch {
    return false;
  }
}

export interface MyEmail { email: string | null; consent: boolean; optedOut: boolean }

/** O que a pessoa pode saber do próprio cadastro de e-mail (24i). `undefined` = sem servidor ou falha de rede. */
export async function getMyEmail(eventId: string): Promise<MyEmail | undefined> {
  if (backendMode() !== "supabase") return undefined;
  try {
    const { data, error } = await browserSupabase().rpc("get_my_email", { p_event: eventId });
    if (error) return undefined;
    const r = (data ?? null) as { email: string | null; consent: boolean; optedOut: boolean } | null;
    return r ?? { email: null, consent: false, optedOut: false };
  } catch {
    return undefined;
  }
}

export type EmailResult = "ok" | "invalid" | "rate-limited" | "forbidden" | "consent" | "unavailable";
const MM: Record<string, EmailResult> = { MM005: "invalid", MM006: "rate-limited", MM004: "forbidden", MM018: "consent" };
const fail = (e: { code?: string } | null | undefined): EmailResult => (e?.code && MM[e.code]) || "unavailable";

/** Guarda (ou, com e-mail vazio, remove) o e-mail no 24i. Devolve o motivo da falha, se houver. */
export async function setMyEmail(eventId: string, email: string): Promise<EmailResult> {
  const e = email.trim();
  if (backendMode() !== "supabase") return "unavailable";
  if (e && !EMAIL_RE.test(e)) return "invalid";
  try {
    const { error } = await browserSupabase().rpc("set_my_email", { p_event: eventId, p_email: e || null, p_consent: Boolean(e) });
    return error ? fail(error as { code?: string }) : "ok";
  } catch {
    return "unavailable";
  }
}

/** "Não quero mais avisos" dentro do app. */
export async function optOutMine(eventId: string): Promise<boolean> {
  if (backendMode() !== "supabase") return false;
  try {
    const { error } = await browserSupabase().rpc("email_opt_out_mine", { p_event: eventId });
    return !error;
  } catch {
    return false;
  }
}

/** A mensagem para a pessoa por motivo de falha. */
export function emailFailureText(r: Exclude<EmailResult, "ok">): string {
  switch (r) {
    case "invalid": return "Esse e-mail não parece certo. Confira e tente de novo.";
    case "rate-limited": return "Muitas tentativas. Espere um pouco e tente de novo.";
    case "forbidden": return "Só quem entrou na festa pode deixar o e-mail.";
    case "consent": return "Precisamos do seu consentimento para guardar o e-mail.";
    default: return "Não deu para salvar agora. Tente de novo.";
  }
}
