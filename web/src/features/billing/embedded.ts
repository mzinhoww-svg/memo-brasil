import { browserSupabase } from "@/lib/supabase/client";

/** Only client-to-edge contract. Secrets, amount, status and entitlements remain server-side. */
export type EmbeddedConfig = {
  enabled: boolean;
  publicKey: string | null;
  env: "sandbox" | "production";
};
export type EmbeddedReceipt = {
  orderId: string;
  status?: string;
  paymentId?: string;
  amountCents?: number;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  statusDetail?: string | null;
  error?: string;
};
export class EmbeddedCheckoutError extends Error {
  constructor(readonly code: string, readonly orderId: string | null = null) {
    super(code);
    this.name = "EmbeddedCheckoutError";
  }
}
async function edge(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await browserSupabase().functions.invoke("payments-embedded", { body });
  if (r.error) {
    const response = (r.error as { context?: unknown }).context;
    let data: Record<string, unknown> = {};
    if (response instanceof Response) {
      try { data = await response.json() as Record<string, unknown>; } catch { /* no payload */ }
    }
    throw new EmbeddedCheckoutError(
      typeof data.error === "string" ? data.error : "indisponivel",
      typeof data.orderId === "string" ? data.orderId : null,
    );
  }
  return (r.data ?? {}) as Record<string, unknown>;
}
export async function embeddedConfig(): Promise<EmbeddedConfig> {
  const d = await edge({ action: "config" });
  const env = d.env === "sandbox" ? "sandbox" : "production";
  return {
    enabled: d.enabled === true && typeof d.publicKey === "string",
    publicKey: typeof d.publicKey === "string" ? d.publicKey : null,
    env,
  };
}
export async function submitEmbeddedPayment(
  eventId: string, planCode: string, idempotencyKey: string,
  formData: Record<string, unknown>,
): Promise<EmbeddedReceipt> {
  // The server ignores formData.transaction_amount and any payer email;
  // uses the verified logged-in organizer, current quote/order, and stable key.
  const d = await edge({ action: "submit", eventId, planCode, idempotencyKey, formData });
  return {
    orderId: String(d.orderId),
    status: typeof d.status === "string" ? d.status : undefined,
    paymentId: typeof d.paymentId === "string" ? d.paymentId : undefined,
    amountCents: typeof d.amountCents === "number" ? d.amountCents : undefined,
    qrCode: typeof d.qrCode === "string" ? d.qrCode : null,
    qrCodeBase64: typeof d.qrCodeBase64 === "string" ? d.qrCodeBase64 : null,
    statusDetail: typeof d.statusDetail === "string" ? d.statusDetail : null,
    error: typeof d.error === "string" ? d.error : undefined,
  };
}
export async function recoverEmbeddedPayment(orderId: string): Promise<EmbeddedReceipt> {
  const d = await edge({ action: "recover", orderId });
  return {
    orderId,
    status: typeof d.status === "string" ? d.status : undefined,
    paymentId: typeof d.paymentId === "string" ? d.paymentId : undefined,
    qrCode: typeof d.qrCode === "string" ? d.qrCode : null,
    qrCodeBase64: typeof d.qrCodeBase64 === "string" ? d.qrCodeBase64 : null,
    error: typeof d.error === "string" ? d.error : undefined,
  };
}
