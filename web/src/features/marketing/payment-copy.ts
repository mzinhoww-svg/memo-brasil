import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";

export function publicPaymentMethod(): string {
  return validapayCheckoutEnabled()
    ? "com Pix ou cartão, sem sair do MemoriesMT"
    : "com Pix ou cartão, conforme disponível no Mercado Pago";
}
