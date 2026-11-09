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
