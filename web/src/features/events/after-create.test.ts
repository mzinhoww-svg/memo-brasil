import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterCreateDestination } from "./after-create";
import type { OrderView } from "@/features/billing/types";

const order = (o: Partial<OrderView>): OrderView => ({ orderId: "o1", status: "pendente", planCode: "festa", amountCents: 2900, provider: "mercadopago", checkoutUrl: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1", ...o } as OrderView);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_CHECKOUT", "0");
  vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW", "0");
});
afterEach(() => vi.unstubAllEnvs());

describe("afterCreateDestination: plano pago escolhido no assistente vai direto ao checkout", () => {
  it("abre o checkout do Mercado Pago com a chave de idempotência do evento e plano", async () => {
    const start = vi.fn().mockResolvedValue(order({}));
    const key = vi.fn().mockReturnValue("k1");
    expect(await afterCreateDestination("ev1", "festa", start, key)).toEqual({ kind: "checkout", url: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1" });
    expect(key).toHaveBeenCalledWith("ev1", "festa");
    expect(start).toHaveBeenCalledWith("ev1", "festa", "k1");
  });
  it("cai na tela de plano (com o plano pré-selecionado) quando o checkout falha", async () => {
    const start = vi.fn().mockRejectedValue(new Error("rede"));
    expect(await afterCreateDestination("ev1", "casamento", start, () => "k")).toEqual({ kind: "plan", href: "/painel/ev1/plano?plano=casamento" });
  });
  it("cai na tela de plano quando o pedido volta sem link de pagamento", async () => {
    const start = vi.fn().mockResolvedValue(order({ checkoutUrl: undefined }));
    expect(await afterCreateDestination("ev1", "festa", start, () => "k")).toEqual({ kind: "plan", href: "/painel/ev1/plano?plano=festa" });
  });
  it("cai na tela de plano quando o pedido aberto é de outro plano (o usuário decide lá)", async () => {
    const start = vi.fn().mockResolvedValue(order({ planCode: "grande" }));
    expect(await afterCreateDestination("ev1", "festa", start, () => "k")).toEqual({ kind: "plan", href: "/painel/ev1/plano?plano=festa" });
  });
});

// Regression: the paid wizard bypassed the native checkout and created a Mercado Pago preference.
describe("assistente com checkout transparente habilitado", () => {
  it.each(["NEXT_PUBLIC_VALIDAPAY_CHECKOUT", "NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW"] as const)(
    "%s mantém o plano e encaminha ao checkout interno sem abrir pedido Mercado Pago", async (flag) => {
      vi.stubEnv(flag, "1");
      const start = vi.fn().mockResolvedValue(order({}));
      const key = vi.fn().mockReturnValue("legacy-key");
      expect(await afterCreateDestination("ev1", "festa", start, key)).toEqual({
        kind: "plan", href: "/painel/ev1/checkout-validapay?plano=festa",
      });
      expect(start).not.toHaveBeenCalled();
      expect(key).not.toHaveBeenCalled();
    },
  );
});
