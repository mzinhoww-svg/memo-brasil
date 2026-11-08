import { browserSupabase } from "@/lib/supabase/client";
export type ValidaPayEnvironment = "sandbox" | "production";
export type SandboxReceipt = { orderId: string; environment: ValidaPayEnvironment; status: string; canAbandon: boolean; amountCents: number; planCode: string; paymentMethod?: string; expiresAt?: string; emv?: string; needsRefund?: boolean; entitlementActive?: boolean };
export type SandboxConfig = { enabled: boolean; environment: ValidaPayEnvironment; publicId: string | null; requires3DS: true };

export class ValidaPayOpenOrderError extends Error {
  constructor() { super("Já existe um pedido aberto. Consulte o pagamento no painel ou abandone a reserva somente quando essa opção estiver disponível."); this.name = "ValidaPayOpenOrderError"; }
}

export class ValidaPayEnvironmentConflictError extends Error {
  constructor() { super("Existe um pedido em outro ambiente de pagamento. Não crie outro pagamento; consulte o suporte para regularizar o pedido."); this.name = "ValidaPayEnvironmentConflictError"; }
}

export function validateReceiptEnvironment(receipt: SandboxReceipt, environment: ValidaPayEnvironment): SandboxReceipt {
  if (!receipt || receipt.environment !== environment) throw new ValidaPayEnvironmentConflictError();
  return receipt;
}

export async function sandboxCall<T>(body: Record<string, unknown>): Promise<T> {
  const result = await browserSupabase().functions.invoke("payments-validapay", { body });
  if (result.error) {
    let code: unknown;
    try {
      const context: unknown = result.error.context;
      if (context instanceof Response) code = (await context.clone().json())?.error;
    } catch { /* Only the allowlisted code below changes the public error. */ }
    if (code === "pedido_aberto") throw new ValidaPayOpenOrderError();
    if (code === "pedido_outro_ambiente") throw new ValidaPayEnvironmentConflictError();
    throw new Error("Não foi possível confirmar o pagamento. Tente novamente; o pedido será reutilizado.");
  }
  return result.data as T;
}
export function sandboxConfig() { return sandboxCall<SandboxConfig>({ action: "config" }); }
export async function sandboxRefund(orderId: string, requestId: string): Promise<{ confirmed: boolean; refundedCents: number }> {
  const result = await browserSupabase().functions.invoke("payments-validapay-refund", { body: { orderId, requestId, confirm: "sandbox-full-refund" } });
  if (result.error) throw new Error("O estorno está em verificação. Não solicite outra devolução.");
  return result.data;
}
export async function recoverSandbox(eventId: string): Promise<SandboxReceipt | null> {
  const data = await sandboxCall<SandboxReceipt | { order: null }>({ action: "recover", eventId });
  return "order" in data ? null : data;
}
