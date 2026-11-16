// Cliente mínimo do wa-gateway (WhatsApp não oficial). Contrato fixo: instância e projeto "revela". Nada aqui lê Deno nem o banco.
// A chave nunca entra em mensagem de erro nem em log.

export type WaConfig = { baseUrl: string; apiKey: string; timeoutMs?: number; fetch?: typeof fetch };
export type WaErrorCode = "invalid" | "unauthorized" | "no_optin" | "rate_limited" | "unavailable" | "timeout" | "network" | "bad_response";

export class WaGatewayError extends Error {
  constructor(readonly code: WaErrorCode, readonly status?: number) {
    super(`wa-gateway: ${code}${status ? ` (${status})` : ""}`);
    this.name = "WaGatewayError";
  }
}

const INSTANCE = "revela";
const PROJECT = "revela";
const PREFIX = "REV";
const TTL_MINUTES = 15;
export const OPTIN_TEMPLATE = "Quero receber os avisos do evento no Revela. Código: {{code}}";
const WA_LINK = /^https:\/\/wa\.me\/[^\s]+$/;

/** URL https sem caminho, e chave presente; senão null (a função responde "indisponível" em vez de chamar um destino estranho). */
export function resolveWaConfig(env: Record<string, string | undefined>): WaConfig | null {
  const raw = env.WA_GATEWAY_URL?.trim();
  const apiKey = env.WA_GATEWAY_API_KEY?.trim();
  if (!raw || !apiKey) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.search || u.hash || u.username || (u.pathname !== "/" && u.pathname !== "")) return null;
    return { baseUrl: u.origin, apiKey, timeoutMs: 8000 };
  } catch {
    return null;
  }
}

async function call(cfg: WaConfig, path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 8000);
  try {
    const res = await (cfg.fetch ?? fetch)(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cfg.apiKey },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    let data: Record<string, unknown> = {};
    try { const j = await res.json(); if (j && typeof j === "object") data = j as Record<string, unknown>; } catch { /* corpo ilegível */ }
    return { status: res.status, data };
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) throw new WaGatewayError("timeout");
    throw new WaGatewayError("network");
  } finally {
    clearTimeout(timer);
  }
}

function failure(status: number, data: Record<string, unknown>): WaGatewayError {
  if (status === 409 && data.error === "NO_OPT_IN") return new WaGatewayError("no_optin", status);
  if (status === 401 || status === 403) return new WaGatewayError("unauthorized", status);
  if (status === 429) return new WaGatewayError("rate_limited", status);
  if (status >= 400 && status < 500) return new WaGatewayError("invalid", status);
  return new WaGatewayError("unavailable", status);
}

/** POST /v1/optin/codes. `subjectId` ≤ 120, `replyText` ≤ 1000, `messageTemplate` ≤ 300 e com {{code}}. */
export async function createOptin(
  cfg: WaConfig, input: { subjectId: string; replyText: string; messageTemplate?: string },
): Promise<{ code: string; expiresAt: string; waLink: string }> {
  const template = input.messageTemplate ?? OPTIN_TEMPLATE;
  if (!input.subjectId || input.subjectId.length > 120 || !input.replyText || input.replyText.length > 1000 || template.length > 300 || !template.includes("{{code}}")) {
    throw new WaGatewayError("invalid");
  }
  const { status, data } = await call(cfg, "/v1/optin/codes", {
    instanceId: INSTANCE, project: PROJECT, subjectId: input.subjectId, prefix: PREFIX,
    replyText: input.replyText, ttlMinutes: TTL_MINUTES, messageTemplate: template,
  });
  if (status < 200 || status >= 300) throw failure(status, data);
  const { code, expiresAt, waLink } = data;
  if (typeof code !== "string" || typeof waLink !== "string" || !WA_LINK.test(waLink)) throw new WaGatewayError("bad_response", status);
  return { code, expiresAt: typeof expiresAt === "string" ? expiresAt : "", waLink };
}

/** POST /v1/messages. 202 {id}; 409 NO_OPT_IN vira `no_optin`. A fila do gateway espaça os envios (4 a 9 s) e limita a 60/h. */
export async function sendMessage(cfg: WaConfig, input: { phone: string; text: string }): Promise<{ id: string }> {
  if (!/^[0-9]{10,15}$/.test(input.phone) || !input.text.trim() || input.text.length > 4000) throw new WaGatewayError("invalid");
  const { status, data } = await call(cfg, "/v1/messages", { instanceId: INSTANCE, phone: input.phone, text: input.text });
  if (status < 200 || status >= 300) throw failure(status, data);
  if (typeof data.id !== "string" || !data.id) throw new WaGatewayError("bad_response", status);
  return { id: data.id };
}
