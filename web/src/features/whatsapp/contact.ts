import type { SupabaseClient } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase/client";

/** Número de WhatsApp guardado na conta (Política v4, seção 3): preenche sozinho nos próximos eventos; campanhas só com autorização própria. */
export type ContactPhone = { phone: string; marketing: boolean };

/** "5565999990000" → "(65) 99999-0000"; fixo "556533221100" → "(65) 3322-1100". */
export function formatBrPhone(e164: string): string {
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return e164;
  const ddd = d.slice(0, 2), n = d.slice(2);
  return `(${ddd}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
}

export async function getMyPhone(client: SupabaseClient = browserSupabase()): Promise<ContactPhone | null> {
  const { data, error } = await client.from("user_contact_phone").select("phone, marketing_optin").maybeSingle();
  if (error || !data) return null;
  return { phone: data.phone as string, marketing: data.marketing_optin === true };
}

/** `marketing`: true autoriza, false retira, undefined mantém. Recusa números inválidos (MM005). */
export async function saveMyPhone(phone: string, marketing: boolean | undefined, eventId: string | null, client: SupabaseClient = browserSupabase()): Promise<void> {
  const { error } = await client.rpc("save_my_phone", { p_phone: phone, p_marketing: marketing ?? null, p_event: eventId });
  if (error) throw new Error("save_my_phone");
}

export async function setMyMarketing(on: boolean, client: SupabaseClient = browserSupabase()): Promise<void> {
  const { error } = await client.rpc("set_my_marketing", { p_on: on });
  if (error) throw new Error("set_my_marketing");
}

export async function forgetMyPhone(client: SupabaseClient = browserSupabase()): Promise<void> {
  const { error } = await client.rpc("forget_my_phone");
  if (error) throw new Error("forget_my_phone");
}
