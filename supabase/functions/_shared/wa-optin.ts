// Regras do pedido de opt-in (puras): quem pode pedir, que subjectId e que texto de volta vão ao gateway. Sem Deno aqui.
import { WaGatewayError } from "./wa-gateway.ts";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const UUID_RE = new RegExp(`^${UUID}$`, "i");
const SUBJECT_RE = new RegExp(`^(${UUID})\\.(${UUID})$`, "i");

/** `<event_id>.<user_id>`: 73 caracteres (o gateway aceita até 120) e nenhum dado pessoal. */
export const subjectIdFor = (eventId: string, userId: string) => `${eventId}.${userId}`;
export function parseSubjectId(s: unknown): { eventId: string; userId: string } | null {
  if (typeof s !== "string" || s.length > 120) return null;
  const m = SUBJECT_RE.exec(s);
  return m ? { eventId: m[1].toLowerCase(), userId: m[2].toLowerCase() } : null;
}

/** Título do evento seguro para as mensagens: sem aspas, chaves, quebras ou controle; no máximo 80 caracteres. */
export function cleanTitle(title: string | null | undefined): string {
  const t = String(title ?? "").replace(/[\u0000-\u001f\u007f"“”{}<>]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t;
}

/** Link de volta: abre a troca do token por sessão (funciona no navegador do WhatsApp, sem a sessão do convidado). */
export const returnLink = (origin: string, code: string, token: string) => `${origin}/e/${code}/voltar?r=${token}`;

/** Mensagem que o bot manda ao confirmar (≤ 1000): nome do evento + link de volta com token de uso único. */
export function buildReplyText(origin: string, code: string, title: string, token: string): string {
  const name = cleanTitle(title);
  return `Pronto! Avisos ${name ? `de "${name}"` : "do Revela"} ativados 🎉 Volte ao evento: ${returnLink(origin, code, token)}`;
}

/** Mensagem pronta que a pessoa envia (≤ 300, com {{code}}). */
export function buildMessageTemplate(title: string): string {
  const name = cleanTitle(title);
  return name ? `Quero receber os avisos de "${name}" no Revela. Código: {{code}}` : "Quero receber os avisos do evento no Revela. Código: {{code}}";
}

/** Token de volta: 32 bytes aleatórios em base64url (43 caracteres). O valor só vai na mensagem; o banco guarda o SHA-256. */
export function newReturnToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const RETURN_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type OptinDeps = {
  /** id do usuário da sessão (anônima também vale); null = sem sessão */
  userId: string | null;
  /** RPC whatsapp_status sob o JWT do chamador: o banco decide quem é participante e se o recurso está ligado */
  status: (eventId: string) => Promise<{ enabled: boolean; eligible: boolean }>;
  rateLimit: (userId: string) => Promise<boolean>;
  eventInfo: (eventId: string) => Promise<{ code: string; title: string } | null>;
  /** guarda o SHA-256 do token de volta (uso único, 2 h) junto do participante */
  issueReturnToken: (eventId: string, userId: string, tokenHash: string) => Promise<void>;
  siteOrigin: string;
  createOptin: (i: { subjectId: string; replyText: string; messageTemplate: string }) => Promise<{ waLink: string; expiresAt?: string }>;
  /** antes de entrar (formulário de entrada): o banco diz se pode preparar o aviso para esse código de evento */
  prejoin?: (code: string, userId: string) => Promise<{ status: string; eventId?: string }>;
  /** só nos testes: token fixo */
  newToken?: () => string;
};
export type OptinResult = { status: number; body: Record<string, unknown> };

export async function handleOptinRequest(input: { eventId?: unknown; code?: unknown; prejoin?: unknown }, d: OptinDeps): Promise<OptinResult> {
  if (!d.userId) return { status: 401, body: { error: "unauthorized" } };
  let eventId = typeof input.eventId === "string" ? input.eventId : "";

  if (input.prejoin === true) {
    // formulário de entrada: ainda não é participante; o opt-in só vale se ele entrar (o banco garante na confirmação e na volta)
    const code = typeof input.code === "string" ? input.code : "";
    if (!/^[A-Za-z0-9]{4,16}$/.test(code) || !d.prejoin) return { status: 400, body: { error: "invalid" } };
    let pj: { status: string; eventId?: string };
    try { pj = await d.prejoin(code, d.userId); } catch { return { status: 503, body: { error: "indisponivel" } }; }
    if (pj.status === "disabled") return { status: 503, body: { error: "indisponivel" } };
    if (pj.status === "not_found") return { status: 404, body: { error: "nao_encontrado" } };
    if (pj.status !== "ok" || !pj.eventId || !UUID_RE.test(pj.eventId)) return { status: 403, body: { error: "forbidden" } };
    eventId = pj.eventId;
  } else {
    if (!UUID_RE.test(eventId)) return { status: 400, body: { error: "invalid" } };
    let st: { enabled: boolean; eligible: boolean };
    try {
      st = await d.status(eventId);
    } catch (e) {
      if ((e as { code?: string })?.code === "MM004") return { status: 403, body: { error: "forbidden" } };
      return { status: 503, body: { error: "indisponivel" } };
    }
    if (!st.enabled) return { status: 503, body: { error: "indisponivel" } };
    if (!st.eligible) return { status: 403, body: { error: "forbidden" } };
  }

  if (!(await d.rateLimit(d.userId))) return { status: 429, body: { error: "muitas_tentativas" } };
  const info = await d.eventInfo(eventId);
  if (!info) return { status: 404, body: { error: "nao_encontrado" } };

  const token = (d.newToken ?? newReturnToken)();
  try {
    await d.issueReturnToken(eventId, d.userId, await sha256Hex(token));
  } catch {
    return { status: 503, body: { error: "indisponivel" } };
  }
  try {
    const r = await d.createOptin({
      subjectId: subjectIdFor(eventId, d.userId),
      replyText: buildReplyText(d.siteOrigin, info.code, info.title, token),
      messageTemplate: buildMessageTemplate(info.title),
    });
    return { status: 200, body: { waLink: r.waLink, eventId, ...(r.expiresAt ? { expiresAt: r.expiresAt } : {}) } };
  } catch (e) {
    if (e instanceof WaGatewayError) return { status: 502, body: { error: "gateway_indisponivel" } };
    throw e;
  }
}
