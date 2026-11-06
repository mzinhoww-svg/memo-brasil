import { browserSupabase } from "@/lib/supabase/client";
export type SandboxReceipt = { orderId: string; status: string; amountCents: number; planCode: string; paymentMethod?: string; expiresAt?: string; emv?: string };
export type SandboxConfig = { enabled: boolean; environment: "sandbox"; publicId: string | null };

export async function sandboxCall<T>(body: Record<string, unknown>): Promise<T> {
  const result = await browserSupabase().functions.invoke("payments-validapay", { body });
  if (result.error) throw new Error("Não foi possível confirmar o pagamento. Tente novamente; o pedido será reutilizado.");
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
