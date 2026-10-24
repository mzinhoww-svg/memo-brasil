import { describe, expect, it, vi } from "vitest";
import { afterCreateDestination } from "./after-create";
import type { OrderView } from "@/features/billing/types";

const order = (o: Partial<OrderView>): OrderView => ({ orderId: "o1", status: "pendente", planCode: "festa", amountCents: 2900, provider: "mercadopago", checkoutUrl: "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1", ...o } as OrderView);

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
