/** Modelos rápidos e leitura de uso/validade dos códigos de cortesia (apresentação; o envio usa a mesma RPC admin_create_code). */

export interface TemplatePlan { code: string; name: string }
export interface CodeTemplate { id: "teste" | "parceiro" | "presente"; label: string; hint: string; plan: string; uses: number; days: number; note: string }

/** Modelos: primeiro plano pago para teste e presente; segundo, se houver, para parceiro. */
export function codeTemplates(plans: readonly TemplatePlan[]): CodeTemplate[] {
  const first = plans[0]?.code ?? "";
  const partner = plans[1]?.code ?? first;
  return [
    { id: "teste", label: "Teste interno", hint: "1 evento, 7 dias", plan: first, uses: 1, days: 7, note: "Teste interno: " },
    { id: "parceiro", label: "Parceiro", hint: "5 eventos, 90 dias", plan: partner, uses: 5, days: 90, note: "Parceiro: " },
    { id: "presente", label: "Presente", hint: "1 evento, 30 dias", plan: first, uses: 1, days: 30, note: "Presente para " },
  ];
}

const CUIABA_OFFSET_MS = -4 * 3_600_000;
/** AAAA-MM-DD (fuso de Cuiabá) daqui a `days` dias. */
export function expiryInDays(days: number, now: Date): string {
  return new Date(now.getTime() + CUIABA_OFFSET_MS + days * 86_400_000).toISOString().slice(0, 10);
}

/** Quanto falta para o código vencer, em texto curto. */
export function validityText(expiresAt: string, nowMs: number): string {
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return "—";
  const day = (ms: number) => Math.floor((ms + CUIABA_OFFSET_MS) / 86_400_000);
  const d = day(t) - day(nowMs); // dias de calendário em Cuiabá
  if (d < 0) return `venceu há ${-d} ${d === -1 ? "dia" : "dias"}`;
  if (d === 0) return "vence hoje";
  return d === 1 ? "vence amanhã" : `${d} dias restantes`;
}

/** Uso do código de 0 a 1 (limite zero conta como cheio). */
export function usageRatio(uses: number, maxUses: number): number {
  return maxUses > 0 ? Math.min(1, Math.max(0, uses / maxUses)) : 1;
}
