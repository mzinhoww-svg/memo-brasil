// Funil de quiz (puro, sem Deno): valida o pedido de lead, monta o texto da oferta que o bot responde no WhatsApp e o subject do
// opt-in. O lead não tem dado pessoal; o telefone nunca chega aqui (o gateway responde sozinho a quem mandou a mensagem).
import { WaGatewayError } from "./wa-gateway.ts";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LEAD_SUBJECT_RE = new RegExp(`^lead\\.(${UUID})$`, "i");
const SLUG_RE = /^[a-z0-9-]{1,40}$/;

/** `lead.<lead_id>`: sem dado pessoal (o do convidado é `<evento>.<usuário>`, o do anfitrião é `host.<usuário>`). */
export const leadSubjectId = (leadId: string) => `lead.${leadId}`;
export function parseLeadSubject(s: unknown): { leadId: string } | null {
  if (typeof s !== "string" || s.length > 120) return null;
  const m = LEAD_SUBJECT_RE.exec(s);
  return m ? { leadId: m[1].toLowerCase() } : null;
}

export type LeadInput = { quiz: string; profile: string | null; guests: number | null; source: string | null; medium: string | null; campaign: string | null; whatsapp: boolean };

const text = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Corpo do pedido: só o que o quiz sabe (nada pessoal). null = inválido. */
export function parseLeadInput(b: unknown): LeadInput | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  if (typeof o.quiz !== "string" || !SLUG_RE.test(o.quiz)) return null;
  if (o.profile !== undefined && o.profile !== null && (typeof o.profile !== "string" || !SLUG_RE.test(o.profile))) return null;
  let guests: number | null = null;
  if (o.guests !== undefined && o.guests !== null) {
    if (typeof o.guests !== "number" || !Number.isInteger(o.guests) || o.guests < 1 || o.guests > 5000) return null;
    guests = o.guests;
  }
  return { quiz: o.quiz, profile: (o.profile as string | null | undefined) ?? null, guests, source: text(o.source, 80), medium: text(o.medium, 40), campaign: text(o.campaign, 60), whatsapp: o.whatsapp !== false };
}

/** Link da oferta com a origem marcada (a página lê o lead pelo id e mostra o tempo que resta, vindo do servidor). */
export function offerLink(origin: string, leadId: string, quiz: string): string {
  const q = new URLSearchParams({ l: leadId, utm_source: "whatsapp", utm_medium: "funil", utm_campaign: quiz });
  return `${origin}/oferta?${q.toString()}`;
}

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export type OfferTerms = { priceCents: number; maxGuests: number; minutes: number };

/**
 * Texto que o bot responde assim que a pessoa manda a mensagem do quiz (≤ 1000 caracteres, limite do gateway).
 * Ordem: o resultado dela, o mecanismo do problema, como o Revela resolve, a oferta com prazo, o link e a saída.
 */
export function buildOfferText(i: { origin: string; leadId: string; quiz: string; guests: number | null; terms: OfferTerms }): string {
  const { terms } = i;
  const festa = i.guests ? `Numa festa de ${i.guests} convidados` : "Num casamento";
  const maior = i.guests && i.guests > terms.maxGuests
    ? ` Sua festa é maior? Comece com ${terms.maxGuests} e aumente depois pagando só a diferença.`
    : "";
  return [
    "Seu resultado chegou! 📸",
    `${festa}, as fotos mais verdadeiras ficam no celular de cada convidado. Depois da festa quase ninguém manda, e o que chega pelo grupo vem em baixa qualidade.`,
    "O Revela junta tudo: cada convidado aponta o celular para o QR da mesa e fotografa, sem baixar aplicativo. As fotos ficam guardadas e se revelam juntas na hora que você escolher.",
    `Oferta de quem fez o teste: câmera para até ${terms.maxGuests} convidados por ${brl(terms.priceCents)} no Pix. Vale por ${terms.minutes} minutos.${maior}`,
    `Ver meu resultado e garantir: ${offerLink(i.origin, i.leadId, i.quiz)}`,
    "Para não receber mais mensagens, responda SAIR.",
  ].join("\n\n");
}

export const LEAD_MESSAGE_TEMPLATE = "Quero receber o resultado do meu teste no Revela. Código: {{code}}";

export type FunnelLeadDeps = {
  /** false = passou do limite de tentativas. */
  rateLimit: () => Promise<boolean>;
  createLead: (i: LeadInput) => Promise<{ leadId: string; expiresAt: string }>;
  terms: () => Promise<OfferTerms>;
  siteOrigin: string;
  /** null = gateway sem configuração (o lead nasce do mesmo jeito; só não há link do WhatsApp). */
  createOptin: ((i: { subjectId: string; replyText: string; messageTemplate: string }) => Promise<{ waLink: string }>) | null;
};

/** Cria o lead e, se pedido, o link do WhatsApp cuja resposta automática é o texto da oferta. O gateway fora do ar não perde o lead. */
export async function handleFunnelLead(body: unknown, d: FunnelLeadDeps): Promise<{ status: number; body: Record<string, unknown> }> {
  const input = parseLeadInput(body);
  if (!input) return { status: 400, body: { error: "invalid" } };
  if (!(await d.rateLimit())) return { status: 429, body: { error: "muitas_tentativas" } };
  const lead = await d.createLead(input);
  let waLink: string | null = null;
  if (input.whatsapp && d.createOptin) {
    try {
      const terms = await d.terms();
      const r = await d.createOptin({
        subjectId: leadSubjectId(lead.leadId),
        replyText: buildOfferText({ origin: d.siteOrigin, leadId: lead.leadId, quiz: input.quiz, guests: input.guests, terms }),
        messageTemplate: LEAD_MESSAGE_TEMPLATE,
      });
      waLink = r.waLink;
    } catch (e) {
      if (!(e instanceof WaGatewayError)) throw e;
    }
  }
  return { status: 200, body: { leadId: lead.leadId, expiresAt: lead.expiresAt, waLink } };
}
