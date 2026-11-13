/** Tipos públicos da camada de billing. Preço, plano e status vêm sempre do servidor; o cliente nunca calcula valor. */

export type PublicPlan = {
  code: string;
  name: string;
  /** `null` = sem limite */
  maxGuests: number | null;
  /** `null` = sem limite */
  maxShots: number | null;
  priceCents: number;
  isFree: boolean;
  features: string[];
  /** Plano em destaque no paywall (um só; definido pelo Master). */
  highlighted?: boolean;
};

/**
 * Pacote "Mais poses" (+12 poses por pessoa): plano-variante oculto do catálogo (`plans.pack_of`). Vem de `list_public_pose_packs`,
 * nunca de `list_public_plans`. `available` = à venda agora; os desligados só servem para reconhecer quem já comprou.
 */
export type PosePack = {
  /** Código da variante (ex.: `festa_36`): é o que se cota, paga e aparece no direito do evento. */
  code: string;
  /** Plano-base (ex.: `festa`). */
  baseCode: string;
  name: string;
  maxGuests: number | null;
  maxShots: number;
  baseMaxShots: number;
  /** Preço TOTAL da variante (base + pacote), em centavos. */
  priceCents: number;
  /** Quanto o pacote custa sobre o plano-base, em centavos. */
  extraCents: number;
  available: boolean;
};

export type OrderStatus = "criado" | "pendente" | "pago" | "expirado" | "cancelado" | "falhou" | "estornado" | "em_disputa" | "perdido";

export type PaymentProvider = "mercadopago" | "abacatepay" | "validapay";

/**
 * Contrato do pedido (design Mercado Pago §1.11). Campos opcionais ficam ausentes quando o servidor manda `null`.
 * `checkoutUrl` é o `init_point` do Checkout Pro (só https; http só em loopback para a fake local). `brCode`/`brCodeBase64` saíram do fluxo.
 * `paymentMethod`: "pix" | "card" | texto livre do provedor; a UI só rotula os conhecidos.
 */
export type OrderView = {
  orderId: string;
  status: OrderStatus;
  planCode: string;
  amountCents: number;
  checkoutUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  provider: PaymentProvider;
  paymentMethod?: string;
  needsRefund?: boolean;
  entitlementActive?: boolean;
};

export type QuoteReason = "ok" | "ja_incluido" | "plano_inativo" | "evento_encerrado" | "valor_minimo";

export type Quote = {
  planCode: string;
  fromPlanCode: string | null;
  amountCents: number;
  payable: boolean;
  reason: QuoteReason;
};

export type PaymentsEnv = "desligado" | "sandbox" | "production";

export type PublicSettings = {
  supportEmail: string | null;
  supportPhone: string | null;
  companyLegalName: string | null;
  companyCnpj: string | null;
  paymentsEnv: PaymentsEnv;
  /** Folga de capacidade em % (0 a 100). */
  capacityGracePct: number;
};

export type RedeemReason = "ok" | "ja_incluido" | "invalido" | "muitas_tentativas" | "evento_encerrado";

export type RedeemResult = { applied: boolean; planCode: string | null; reason: RedeemReason };

/** Leitura do presente pelo link `/c/<código>` (RPC `peek_code`): nunca consome uso. */
export type GiftStatus = "ativo" | "usado" | "expirado" | "revogado" | "invalido";
export type GiftView = { status: GiftStatus; planCode: string | null; planName: string | null; maxGuests: number | null; maxShots: number | null };
