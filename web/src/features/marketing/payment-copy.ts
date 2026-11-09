import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";

export function publicPaymentMethod(): string {
  return validapayCheckoutEnabled()
    ? "com Pix ou cartão, sem sair do Revela"
    : "com Pix ou cartão, conforme disponível no Mercado Pago";
}
