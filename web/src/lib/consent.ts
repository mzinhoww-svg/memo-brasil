import type { SupabaseClient } from "@supabase/supabase-js";
import { browserSupabase } from "./supabase/client";

/** Versões publicadas em `legal_documents` (migration 20261022001100). Texto ainda em rascunho: sem revisão jurídica registrada. */
export const TERMS_VERSION = "2026-10-21-rascunho";
export const PRIVACY_VERSION = "2026-10-21-rascunho";

export type ConsentRole = "organizador" | "convidado";
export type ConsentInput = { termsVersion: string; privacyVersion: string; role: ConsentRole; eventId: string | null };

export class ConsentError extends Error {
  constructor(message = "Não foi possível registrar o seu aceite.") {
    super(message);
    this.name = "ConsentError";
  }
}

export const currentConsent = (role: ConsentRole, eventId: string | null): ConsentInput => ({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, role, eventId });

/** Grava o aceite no servidor (ator, horário e auditoria são do banco). Falha vira ConsentError: a tela não pode seguir como se tivesse gravado. */
export async function recordConsent(input: ConsentInput, client: SupabaseClient = browserSupabase()): Promise<void> {
  if (input.role !== "organizador" && input.role !== "convidado") throw new ConsentError();
  const { error } = await client.rpc("record_consent", { p_terms_version: input.termsVersion, p_privacy_version: input.privacyVersion, p_role: input.role, p_event_id: input.eventId });
  if (error) throw new ConsentError();
}
