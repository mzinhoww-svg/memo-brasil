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

/** Mensagem que o bot manda ao confirmar: leva o link de volta à tela "Você" do evento (deep link). */
export const buildReplyText = (origin: string, code: string) => `Pronto! Avisos do Revela ativados 🎉 Volte ao evento: ${origin}/e/${code}/voce`;

export type OptinDeps = {
  /** id do usuário da sessão (anônima também vale); null = sem sessão */
  userId: string | null;
  /** RPC whatsapp_status sob o JWT do chamador: o banco decide quem é participante e se o recurso está ligado */
  status: (eventId: string) => Promise<{ enabled: boolean; eligible: boolean }>;
  rateLimit: (userId: string) => Promise<boolean>;
  eventCode: (eventId: string) => Promise<string | null>;
  siteOrigin: string;
  createOptin: (i: { subjectId: string; replyText: string }) => Promise<{ waLink: string }>;
};
export type OptinResult = { status: number; body: Record<string, unknown> };

export async function handleOptinRequest(input: { eventId?: unknown }, d: OptinDeps): Promise<OptinResult> {
  if (!d.userId) return { status: 401, body: { error: "unauthorized" } };
  const eventId = typeof input.eventId === "string" ? input.eventId : "";
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

  if (!(await d.rateLimit(d.userId))) return { status: 429, body: { error: "muitas_tentativas" } };
  const code = await d.eventCode(eventId);
  if (!code) return { status: 404, body: { error: "nao_encontrado" } };

  try {
    const r = await d.createOptin({ subjectId: subjectIdFor(eventId, d.userId), replyText: buildReplyText(d.siteOrigin, code) });
    return { status: 200, body: { waLink: r.waLink } };
  } catch (e) {
    if (e instanceof WaGatewayError) return { status: 502, body: { error: "gateway_indisponivel" } };
    throw e;
  }
}
