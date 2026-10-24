import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmbeddedCheckoutError, embeddedConfig, recoverEmbeddedPayment, submitEmbeddedPayment,
} from "./embedded";

const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  browserSupabase: () => ({ functions: { invoke: mock.invoke } }),
}));

describe("MemoriesMT embedded checkout transport", () => {
  beforeEach(() => mock.invoke.mockReset());

  it("does not enable checkout if provider flag is disabled", async () => {
    mock.invoke.mockResolvedValue({ data: { enabled: false, publicKey: null, env: "production" }, error: null });
    expect(await embeddedConfig()).toEqual({ enabled: false, publicKey: null, env: "production" });
    expect(mock.invoke).toHaveBeenCalledWith("payments-embedded", { body: { action: "config" } });
  });

  it("uses no browser-provided amount or secret as an independent checkout parameter", async () => {
    mock.invoke.mockResolvedValue({
      data: { orderId: "order-123", status: "pending", amountCents: 34900,
        qrCode: "pix-brcode", qrCodeBase64: "aGVsbG8=" }, error: null,
    });
    const formData = { transaction_amount: 1, payment_method_id: "pix",
      payer: { identification: { type: "CPF", number: "12345678909" } } };
    const got = await submitEmbeddedPayment("event-1", "grande", "idempotency-key", formData);
    expect(got.amountCents).toBe(34900);
    expect(got.qrCode).toBe("pix-brcode");
    const req = mock.invoke.mock.calls[0][1].body;
    expect(req).toEqual({ action: "submit", eventId: "event-1",
      planCode: "grande", idempotencyKey: "idempotency-key", formData });
    expect(req).not.toHaveProperty("amountCents");
    expect(req).not.toHaveProperty("accessToken");
  });

  it("recovers pending Pix only through the authorized order endpoint", async () => {
    mock.invoke.mockResolvedValue({ data: {
      orderId: "uuid-1", status: "pending", qrCode: "real-pix",
    }, error: null });
    const got = await recoverEmbeddedPayment("uuid-1");
    expect(got.qrCode).toBe("real-pix");
    expect(mock.invoke).toHaveBeenCalledWith("payments-embedded",
      { body: { action: "recover", orderId: "uuid-1" } });
  });

  it("preserves ambiguous order id on provider errors to prevent duplicate payment", async () => {
    mock.invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({
        error: "provedor_indisponivel", orderId: "pending-id",
      }), { status: 502, headers: { "content-type": "application/json" } }) },
    });
    await expect(submitEmbeddedPayment("event-1", "grande", "key-1", {}))
      .rejects.toMatchObject({ code: "provedor_indisponivel", orderId: "pending-id" });
  });

  it("does not expose raw provider error contents", async () => {
    mock.invoke.mockResolvedValue({
      data: null, error: { context: new Response("bad upstream response", { status: 502 }) },
    });
    await expect(embeddedConfig()).rejects.toBeInstanceOf(EmbeddedCheckoutError);
  });
});
