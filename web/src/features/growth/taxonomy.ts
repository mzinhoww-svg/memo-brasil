/**
 * Growth Factory — taxonomia CANÔNICA, somente tipagem/contrato.
 *
 * Este módulo NÃO envia telemetria nem altera a produção.
 * A emissão, a persistência e o cálculo de conversões precisam ser
 * implantados com gates separados, após testes de privacidade e RLS.
 *
 * Regras:
 * - eventos de receita jamais são confirmados pelo browser;
 * - criação de evento e uso de produto usam fonte de verdade no banco;
 * - page views não podem ser ligados a contas a partir do hash diário atual;
 * - propriedades como nome, email, IP, WhatsApp, imagem e biometria são proibidas.
 */
export const GROWTH_EVENTS = {
  page_viewed: { origin: "browser", countedBy: "access_hits" },
  signup_completed: { origin: "server", countedBy: "auth" },
  event_created: { origin: "server", countedBy: "events" },
  plan_viewed: { origin: "browser", countedBy: "future_growth_events" },
  checkout_started: { origin: "server", countedBy: "payment_orders" },
  payment_approved: { origin: "provider", countedBy: "payment_orders" },
  first_guest_joined: { origin: "server", countedBy: "participants" },
  first_photo_uploaded: { origin: "server", countedBy: "photos" },
  album_revealed: { origin: "server", countedBy: "events" },
  invitation_shared: { origin: "browser", countedBy: "future_growth_events" },
} as const;

export type GrowthEventName = keyof typeof GROWTH_EVENTS;
export type GrowthEventOrigin = "browser" | "server" | "provider";
export const GROWTH_TAXONOMY_VERSION = 1;

export const GROWTH_FUNNEL = [
  { step: "visita", event: "page_viewed" },
  { step: "cadastro", event: "signup_completed" },
  { step: "evento_criado", event: "event_created" },
  { step: "checkout", event: "checkout_started" },
  { step: "pagamento_aprovado", event: "payment_approved" },
] as const satisfies ReadonlyArray<{ step: string; event: GrowthEventName }>;

export function isGrowthEventName(value: unknown): value is GrowthEventName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GROWTH_EVENTS, value);
}

/** Conversão paga exige a confirmação confiável do provedor/servidor, nunca um clique no browser. */
export function isVerifiedPayment(name: GrowthEventName, origin: GrowthEventOrigin): boolean {
  return name === "payment_approved" && origin === "provider";
}

/** Retorna fração [0, 1]; null indica denominador inválido/ausente, não 0% de conversão. */
export function conversionRate(successes: number, opportunities: number): number | null {
  if (!Number.isFinite(successes) || !Number.isFinite(opportunities) || successes < 0 || opportunities <= 0) return null;
  if (successes > opportunities) return null; // mistura de coortes ou eventos duplicados
  return successes / opportunities;
}
