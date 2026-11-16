// Cola Deno das funções de WhatsApp (lê Deno.env e cria clientes Supabase). A lógica testável fica em wa-*.ts, sem Deno.
// Nunca registra telefone, corpo bruto, chave nem segredo: o log é só {fn, outcome}.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { resolveWaConfig, type WaConfig } from "./wa-gateway.ts";

export const DEFAULT_SITE = "https://newmemocuiaba.vercel.app";

export function waConfig(): WaConfig | null {
  return resolveWaConfig({ WA_GATEWAY_URL: Deno.env.get("WA_GATEWAY_URL"), WA_GATEWAY_API_KEY: Deno.env.get("WA_GATEWAY_API_KEY") });
}

/** Origem pública do app para os links da mensagem. Só https e sem caminho; senão o domínio oficial. */
export function siteOrigin(): string {
  const raw = Deno.env.get("PUBLIC_SITE_URL");
  if (!raw) return DEFAULT_SITE;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.pathname === "/" || u.pathname === "") && !u.search && !u.username ? u.origin : DEFAULT_SITE;
  } catch {
    return DEFAULT_SITE;
  }
}

export const adminClient = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export const logWa = (fn: string, outcome: string): void => console.log(JSON.stringify({ fn, outcome }));

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-content-type-options": "nosniff", "cache-control": "no-store" } });

/** Igualdade em tempo constante (o dispatch compara o Bearer com a service_role). */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
