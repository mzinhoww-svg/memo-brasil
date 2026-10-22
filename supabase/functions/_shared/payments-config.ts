// Configuração do provedor para as funções de pagamento. Módulo puro (recebe as variáveis; não lê Deno.env), testado no vitest.
// Regras:
// - ABACATEPAY_ENV ∈ sandbox | production; a chave precisa do prefixo do ambiente (abc_dev_ | abc_prod_).
// - ABACATEPAY_BASE_URL (opcional) só é aceita com ABACATEPAY_ENV=sandbox, protocolo http/https, sem usuário/senha na URL e
//   hostname exatamente localhost, 127.0.0.1 ou host.docker.internal (o último é como o container do Edge Runtime alcança
//   o fake de testes na máquina). Qualquer outro valor recusa operar, em vez de cair silenciosamente na API real.
// O motivo de recusa nunca carrega a chave.
import type { AbacateConfig } from "./abacatepay.ts";

export const ABACATEPAY_DEFAULT_BASE_URL = "https://api.abacatepay.com/v2";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "host.docker.internal"]);

export type ProviderEnv = "sandbox" | "production";
export type ResolvedConfig =
  | { ok: true; env: ProviderEnv; config: AbacateConfig }
  | { ok: false; reason: "ambiente" | "chave_ambiente" | "base_url" };

export function resolveAbacateConfig(vars: Record<string, string | undefined>): ResolvedConfig {
  const env = vars.ABACATEPAY_ENV;
  if (env !== "sandbox" && env !== "production") return { ok: false, reason: "ambiente" };
  const apiKey = vars.ABACATEPAY_API_KEY ?? "";
  if (!apiKey.startsWith(env === "sandbox" ? "abc_dev_" : "abc_prod_")) return { ok: false, reason: "chave_ambiente" };

  const override = (vars.ABACATEPAY_BASE_URL ?? "").trim();
  if (!override) return { ok: true, env, config: { apiKey, baseUrl: ABACATEPAY_DEFAULT_BASE_URL } };
  if (env !== "sandbox") return { ok: false, reason: "base_url" };
  let u: URL;
  try {
    u = new URL(override);
  } catch {
    return { ok: false, reason: "base_url" };
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password || !LOCAL_HOSTS.has(u.hostname)) {
    return { ok: false, reason: "base_url" };
  }
  return { ok: true, env, config: { apiKey, baseUrl: override.replace(/\/+$/, "") } };
}
