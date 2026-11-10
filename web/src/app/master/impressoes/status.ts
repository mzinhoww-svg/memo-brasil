import type { Tone } from "@/revela/master-kit";

export type PrintStatus = "solicitado" | "em_producao" | "enviado" | "entregue" | "cancelado";
export const STATUS_LABEL: Record<PrintStatus, string> = { solicitado: "Solicitado", em_producao: "Em produção", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
export const STATUS_TONE: Record<PrintStatus, Tone> = { solicitado: "wait", em_producao: "info", enviado: "info", entregue: "ok", cancelado: "bad" };
export const FILTERS: [string, string][] = [["", "Todos"], ["solicitado", "Solicitados"], ["em_producao", "Em produção"], ["enviado", "Enviados"], ["entregue", "Entregues"], ["cancelado", "Cancelados"]];

/** Próximo passo permitido (o banco confere de novo): solicitado → em produção → enviado → entregue; cancelar até o envio. */
export function nextSteps(s: PrintStatus): { to: Exclude<PrintStatus, "solicitado">; label: string; needsReason?: boolean }[] {
  switch (s) {
    case "solicitado": return [{ to: "em_producao", label: "Iniciar produção" }, { to: "cancelado", label: "Cancelar", needsReason: true }];
    case "em_producao": return [{ to: "enviado", label: "Marcar enviado" }, { to: "cancelado", label: "Cancelar", needsReason: true }];
    case "enviado": return [{ to: "entregue", label: "Marcar entregue" }];
    default: return [];
  }
}
export const isStatus = (v: unknown): v is PrintStatus => typeof v === "string" && v in STATUS_LABEL;
