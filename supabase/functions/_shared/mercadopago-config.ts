// Configuração do Mercado Pago para as Edge Functions. Módulo puro (recebe as variáveis; não lê Deno.env).
// - MERCADOPAGO_ACCESS_TOKEN: obrigatório. O ambiente (sandbox/produção) NÃO é deduzido do token: vem de payments_env() no
//   banco e, por pagamento, de live_mode da API.
// - MERCADOPAGO_BASE_URL (opcional, só para o fake local de testes): hostname exatamente localhost, 127.0.0.1 ou
//   host.docker.internal, http/https, sem usuário/senha. Qualquer outro valor recusa operar em vez de cair na API real.
// O motivo de recusa nunca carrega o token.
import type { MercadoPagoConfig } from "./mercadopago.ts";

export const MERCADOPAGO_DEFAULT_BASE_URL = "https://api.mercadopago.com";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "host.docker.internal"]);

export type ResolvedMercadoPagoConfig =
  | { ok: true; config: MercadoPagoConfig }
  | { ok: false; reason: "token" | "base_url" };

export type ProviderEnvName = "sandbox" | "production";

/**
 * `env` escolhe o par de credenciais: production = MERCADOPAGO_ACCESS_TOKEN; sandbox = MERCADOPAGO_ACCESS_TOKEN_SANDBOX.
 * Sandbox NUNCA cai no token de produção na API real (recusa). Só contra o fake local (MERCADOPAGO_BASE_URL local) o token
 * único dos testes serve aos dois. Sem `env` o comportamento é o legado (token principal).
 */
export function resolveMercadoPagoConfig(vars: Record<string, string | undefined>, env?: ProviderEnvName | null): ResolvedMercadoPagoConfig {
  const override = (vars.MERCADOPAGO_BASE_URL ?? "").trim();
  let accessToken = (vars.MERCADOPAGO_ACCESS_TOKEN ?? "").trim();
  if (env === "sandbox") {
    const sandbox = (vars.MERCADOPAGO_ACCESS_TOKEN_SANDBOX ?? "").trim();
    accessToken = sandbox || (override ? accessToken : "");
  }
  if (!accessToken) return { ok: false, reason: "token" };
  if (!override) return { ok: true, config: { accessToken, baseUrl: MERCADOPAGO_DEFAULT_BASE_URL } };
  let u: URL;
  try {
    u = new URL(override);
  } catch {
    return { ok: false, reason: "base_url" };
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password || !LOCAL_HOSTS.has(u.hostname)) {
    return { ok: false, reason: "base_url" };
  }
  return { ok: true, config: { accessToken, baseUrl: override.replace(/\/+$/, "") } };
}
