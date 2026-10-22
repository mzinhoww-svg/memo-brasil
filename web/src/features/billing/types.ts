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
};

export type OrderStatus = "criado" | "pendente" | "pago" | "expirado" | "cancelado" | "falhou" | "estornado" | "em_disputa" | "perdido";

/** Campos opcionais ausentes quando o servidor manda `null`. */
export type OrderView = {
  orderId: string;
  status: OrderStatus;
  planCode: string;
  amountCents: number;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string;
  paidAt?: string;
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

export type RedeemReason = "ok" | "ja_incluido" | "invalido" | "muitas_tentativas";

export type RedeemResult = { applied: boolean; planCode: string | null; reason: RedeemReason };
