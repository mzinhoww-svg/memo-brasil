// Avisos ao ANFITRIÃO por WhatsApp (puro, sem Deno): subject do opt-in, textos e o pedido de opt-in.
// A fila e as regras de quem pode receber ficam no banco (host_claim_batch); aqui só se monta o texto e o link.
import { WaGatewayError } from "./wa-gateway.ts";
import { cleanTitle } from "./wa-optin.ts";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const HOST_SUBJECT_RE = new RegExp(`^host\\.(${UUID})$`, "i");

/** `host.<user_id>`: conta do anfitrião, sem dado pessoal (o do convidado é `<evento>.<usuário>`). */
export const hostSubjectId = (userId: string) => `host.${userId}`;
export function parseHostSubject(s: unknown): { userId: string } | null {
  if (typeof s !== "string" || s.length > 120) return null;
  const m = HOST_SUBJECT_RE.exec(s);
  return m ? { userId: m[1].toLowerCase() } : null;
}

export type HostItem = {
  id: number; kind: string; phone: string | null; host_name: string | null; event_id: string;
  event_title: string; event_code: string; plan_code: string | null; attempts: number;
};

const SAIR = "Para não receber mais avisos, responda SAIR.";
const firstName = (name: string | null) => cleanTitle(name).split(" ")[0];
const greet = (name: string | null) => (firstName(name) ? `Oi, ${firstName(name)}!` : "Oi!");

/** Reabre o plano do evento com a mesma faixa já escolhida; um toque gera a cobrança nova (Pix vencido não volta). */
export function recoveryLink(origin: string, i: Pick<HostItem, "event_id" | "plan_code" | "kind">): string {
  const q = new URLSearchParams();
  if (i.plan_code) q.set("plano", i.plan_code);
  q.set("utm_source", "whatsapp"); q.set("utm_medium", "recuperacao"); q.set("utm_campaign", i.kind);
  return `${origin}/painel/${i.event_id}/plano?${q.toString()}`;
}

/** Textos da Coordenação (textos-app-conversao.md, seção 2), com a saída por SAIR. null = tipo sem texto. */
export function buildHostMessage(i: HostItem, origin: string): string | null {
  const title = cleanTitle(i.event_title);
  switch (i.kind) {
    case "pedido_1h":
      return `${greet(i.host_name)} Vi que o pagamento da câmera do seu evento não foi concluído. Quer tentar de novo? É só tocar aqui: ${recoveryLink(origin, i)}\n\n${SAIR}`;
    case "pedido_24h":
      return `${firstName(i.host_name) ? `${firstName(i.host_name)}, a` : "A"} câmera ${title ? `de "${title}"` : "do seu evento"} continua pronta te esperando. Se preferir, dá para seguir no plano grátis e mudar depois. Retomar: ${recoveryLink(origin, i)}\n\n${SAIR}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- pedido de opt-in (o anfitrião manda a mensagem pelo WhatsApp)
export type HostOptinDeps = {
  userId: string | null;
  status: () => Promise<{ enabled: boolean }>;
  rateLimit: (userId: string) => Promise<boolean>;
  siteOrigin: string;
  createOptin: (i: { subjectId: string; replyText: string; messageTemplate: string }) => Promise<{ waLink: string; expiresAt?: string }>;
};

export async function handleHostOptinRequest(d: HostOptinDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!d.userId) return { status: 401, body: { error: "unauthorized" } };
  let st: { enabled: boolean };
  try { st = await d.status(); } catch { return { status: 503, body: { error: "indisponivel" } }; }
  if (!st.enabled) return { status: 503, body: { error: "indisponivel" } };
  if (!(await d.rateLimit(d.userId))) return { status: 429, body: { error: "muitas_tentativas" } };
  try {
    const r = await d.createOptin({
      subjectId: hostSubjectId(d.userId),
      replyText: `Pronto! Avisos do Revela ativados ✅ Você vai receber por aqui os lembretes do seu evento e do pagamento. ${SAIR} Seus eventos: ${d.siteOrigin}/eventos`,
      messageTemplate: "Quero receber os avisos do meu evento no Revela. Código: {{code}}",
    });
    return { status: 200, body: { waLink: r.waLink, ...(r.expiresAt ? { expiresAt: r.expiresAt } : {}) } };
  } catch (e) {
    if (e instanceof WaGatewayError) return { status: 502, body: { error: "gateway_indisponivel" } };
    throw e;
  }
}
