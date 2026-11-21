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
/** WhatsApp de vendas: dúvida sobre plano/pagamento vai para uma pessoa (este número só envia avisos). */
export const SALES_WA = "https://wa.me/5565996227110";
const DUVIDAS = `Dúvidas? Fale com a gente: ${SALES_WA}`;
const firstName = (name: string | null) => cleanTitle(name).split(" ")[0];
const greet = (name: string | null) => (firstName(name) ? `Oi, ${firstName(name)}!` : "Oi!");

/** Reabre o plano do evento com a mesma faixa já escolhida; um toque gera a cobrança nova (Pix vencido não volta). */
export function recoveryLink(origin: string, i: Pick<HostItem, "event_id" | "plan_code" | "kind">): string {
  const q = new URLSearchParams();
  if (i.plan_code) q.set("plano", i.plan_code);
  q.set("utm_source", "whatsapp"); q.set("utm_medium", "recuperacao"); q.set("utm_campaign", i.kind);
  return `${origin}/painel/${i.event_id}/plano?${q.toString()}`;
}

/** Link do painel do evento com a origem marcada (ativação do evento grátis). */
export function eventLink(origin: string, i: Pick<HostItem, "event_id" | "kind">, page: "qr" | "plano"): string {
  const q = new URLSearchParams({ utm_source: "whatsapp", utm_medium: "ativacao", utm_campaign: i.kind });
  return `${origin}/painel/${i.event_id}/${page}?${q.toString()}`;
}

/** Textos da Coordenação (textos-app-conversao.md, seções 2 e 3), com o contato de vendas e a saída por SAIR. null = tipo sem texto. */
export function buildHostMessage(i: HostItem, origin: string): string | null {
  const title = cleanTitle(i.event_title);
  switch (i.kind) {
    case "pedido_1h":
      return `${greet(i.host_name)} Vi que o pagamento da câmera do seu evento não foi concluído. Quer tentar de novo? É só tocar aqui: ${recoveryLink(origin, i)}\n\n${DUVIDAS}\n${SAIR}`;
    case "pedido_24h":
      return `${firstName(i.host_name) ? `${firstName(i.host_name)}, a` : "A"} câmera ${title ? `de "${title}"` : "do seu evento"} continua pronta te esperando. Se preferir, dá para seguir no plano grátis e mudar depois. Retomar: ${recoveryLink(origin, i)}\n\n${DUVIDAS}\n${SAIR}`;
    // ---- ativação do evento grátis (seção 3); texto da véspera aprovado pela Coordenação
    case "ativ_criado":
      return `Sua câmera ${title ? `"${title}"` : "do evento"} está pronta! 🎉 Próximo passo: imprima o QR e coloque nas mesas. Seus convidados fotografam pelo celular, sem baixar aplicativo. Ver o QR: ${eventLink(origin, i, "qr")}\n\n${DUVIDAS}\n${SAIR}`;
    case "ativ_3d":
      return `Faltam 3 dias para ${title ? `o ${title}` : "o seu evento"}! Já espalhou o QR? Dica: coloque um em cada mesa e um na entrada. ${eventLink(origin, i, "qr")}\n\n${DUVIDAS}\n${SAIR}`;
    case "ativ_vespera":
      return `Amanhã é o grande dia${title ? `: ${title}` : ""}! 🎉 Já imprimiu o QR e colocou nas mesas? Na hora, os convidados apontam a câmera do celular e fotografam, sem baixar nada. Ver o QR: ${eventLink(origin, i, "qr")}\n\n${DUVIDAS}\n${SAIR}`;
    case "ativ_dia_seguinte":
      return `As fotos ${title ? `do ${title}` : "do seu evento"} estão chegando! 📸 Se a festa foi grande, vale liberar mais convidados e mais poses para ninguém ficar de fora: ${eventLink(origin, i, "plano")}\n\n${DUVIDAS}\n${SAIR}`;
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
