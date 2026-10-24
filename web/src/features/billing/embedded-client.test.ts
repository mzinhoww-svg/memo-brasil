import { describe, expect, it, vi } from "vitest";
import {
  createEmbeddedPayment, MercadoPagoError,
} from "../../../../supabase/functions/_shared/mercadopago";

const valid = {
  orderId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  amountCents: 34900,
  paymentMethodId: "pix",
  payerEmail: "buyer@example.com",
  payerDocument: { type: "CPF" as const, number: "12345678909" },
  description: "MemoriesMT Grande",
  notificationUrl: "https://example.com/webhook",
};

describe("Checkout Transparente — Mercado Pago client", () => {
  it("creates Pix with BRL 349.00, server-owned reference and stable idempotency key", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.transaction_amount).toBe(349);
      expect(body.external_reference).toBe(valid.orderId);
      expect(body.payment_method_id).toBe("pix");
      expect(body.payer.identification.type).toBe("CPF");
      expect(body.payer.email).toBe("buyer@example.com");
      expect(init?.headers).toMatchObject({ "X-Idempotency-Key": valid.orderId });
      return new Response(JSON.stringify({
        id: 123456, status: "pending", status_detail: "pending_waiting_transfer",
        point_of_interaction: { transaction_data: { qr_code: "br-pix-code", qr_code_base64: "YWJj" } },
      }), { status: 201 });
    });
    const cfg = { accessToken: "TEST-EXAMPLE", baseUrl: "https://api.mercadopago.com", fetchImpl: fetchImpl as typeof fetch };
    const result = await createEmbeddedPayment(cfg, valid);
    expect(result).toMatchObject({ paymentId: "123456", status: "pending", qrCode: "br-pix-code", qrCodeBase64: "YWJj" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects cards without a token before contacting provider", async () => {
    const fetchImpl = vi.fn();
    await expect(createEmbeddedPayment({ accessToken: "x", baseUrl: "https://api.mercadopago.com",
      fetchImpl: fetchImpl as typeof fetch }, {
      ...valid, paymentMethodId: "visa", card: { token: "short", installments: 1 },
    })).rejects.toBeInstanceOf(MercadoPagoError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends only tokenized card data, with no PAN or CVV to the payment API", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.token).toBe("tok_123456789012345678");
      expect(body.installments).toBe(1);
      expect(body).not.toHaveProperty("card_number");
      expect(body).not.toHaveProperty("security_code");
      expect(body).not.toHaveProperty("cvv");
      return new Response(JSON.stringify({ id: 2222, status: "approved" }), { status: 201 });
    });
    const cfg = { accessToken: "test-only", baseUrl: "https://api.mercadopago.com", fetchImpl: fetchImpl as typeof fetch };
    const receipt = await createEmbeddedPayment(cfg, {
      ...valid, paymentMethodId: "visa", card: { token: "tok_123456789012345678", installments: 1 },
    });
    expect(receipt.status).toBe("approved");
    expect(receipt.qrCode).toBeNull();
  });
});
