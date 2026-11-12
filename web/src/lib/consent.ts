import type { SupabaseClient } from "@supabase/supabase-js";
import { browserSupabase } from "./supabase/client";

/** Versões publicadas em `legal_documents` (migration 20261022001300). Origem: texto fornecido pelo operador; nenhuma revisão jurídica profissional registrada. */
export const TERMS_VERSION = "2026-10-22-v1";
export const PRIVACY_VERSION = "2026-10-22-v1";

export type ConsentRole = "organizador" | "convidado";
export type ConsentContext = "criar-evento" | "entrar-evento";
/** Duas afirmações separadas: aceite contratual dos Termos e ciência da Política (que não é consentimento genérico). */
export type ConsentAcks = { termsAccepted: boolean; privacyAcknowledged: boolean };
export type ConsentInput = { termsVersion: string; privacyVersion: string; role: ConsentRole; eventId: string | null; context: ConsentContext } & ConsentAcks;

export class ConsentError extends Error {
  constructor(message = "Não foi possível registrar o seu aceite.") {
    super(message);
    this.name = "ConsentError";
  }
}

export const currentConsent = (role: ConsentRole, eventId: string | null, acks: ConsentAcks): ConsentInput => ({
  termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, role, eventId, context: role === "organizador" ? "criar-evento" : "entrar-evento", ...acks,
});

/** Grava o aceite no servidor (ator, horário e auditoria são do banco). Falha vira ConsentError: a tela não pode seguir como se tivesse gravado. */
export async function recordConsent(input: ConsentInput, client: SupabaseClient = browserSupabase()): Promise<void> {
  if (input.role !== "organizador" && input.role !== "convidado") throw new ConsentError();
  if (!input.termsAccepted || !input.privacyAcknowledged) throw new ConsentError(); // nada vale por omissão: o servidor também recusa
  const { error } = await client.rpc("record_consent", {
    p_terms_version: input.termsVersion, p_privacy_version: input.privacyVersion, p_role: input.role, p_event_id: input.eventId,
    p_terms_accepted: input.termsAccepted, p_privacy_ack: input.privacyAcknowledged, p_context: input.context,
  });
  if (error) throw new ConsentError();
}

/**
 * Aceite já registrado neste aparelho para as versões vigentes: quem já aceitou não é perguntado de novo a cada evento.
 * O servidor continua gravando o aceite a cada criação (`recordConsent`); isto só poupa o diálogo. Sem armazenamento, pergunta.
 */
const rememberedKey = (userId: string) => `rv:consent:${TERMS_VERSION}:${PRIVACY_VERSION}:organizador:${userId}`;
export function hasRememberedConsent(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try { return window.localStorage.getItem(rememberedKey(userId)) === "1"; } catch { return false; }
}
export function rememberConsent(userId: string | null | undefined): void {
  if (!userId) return;
  try { window.localStorage.setItem(rememberedKey(userId), "1"); } catch { /* sem armazenamento: o diálogo volta a aparecer */ }
}
