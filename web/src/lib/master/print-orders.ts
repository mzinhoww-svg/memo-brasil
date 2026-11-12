/** Pedidos de impressão no Master (M29/M30): status, textos, formatos e a linha do tempo. O banco confere a ordem de novo (MM009). */
export type PrintStatus = "solicitado" | "em_producao" | "enviado" | "entregue" | "cancelado";
export type PrintTone = "wait" | "info" | "ok" | "mute";

export const STATUS_LABEL: Record<PrintStatus, string> = { solicitado: "solicitado", em_producao: "em produção", enviado: "enviado", entregue: "entregue", cancelado: "cancelado" };
export const STATUS_TONE: Record<PrintStatus, PrintTone> = { solicitado: "wait", em_producao: "info", enviado: "info", entregue: "ok", cancelado: "mute" };
/** Chips da lista: "Todos" e um por status, com a contagem de cada um. */
export const FILTERS: readonly { key: "" | PrintStatus; label: string }[] = [
  { key: "", label: "Todos" }, { key: "solicitado", label: "Solicitado" }, { key: "em_producao", label: "Em produção" },
  { key: "enviado", label: "Enviado" }, { key: "entregue", label: "Entregue" }, { key: "cancelado", label: "Cancelado" },
];
export const isStatus = (v: unknown): v is PrintStatus => typeof v === "string" && v in STATUS_LABEL;

/** Passo seguinte permitido: solicitado → em produção → enviado → entregue. Só isso; nunca volta nem pula. */
export const NEXT_STATUS: Record<PrintStatus, Exclude<PrintStatus, "solicitado" | "cancelado"> | null> = {
  solicitado: "em_producao", em_producao: "enviado", enviado: "entregue", entregue: null, cancelado: null,
};
/** Cancelar vale até o envio; cancelado não reabre. */
export const canCancel = (s: PrintStatus): boolean => s === "solicitado" || s === "em_producao";
export const ADVANCE: Record<Exclude<PrintStatus, "solicitado" | "cancelado">, { button: string; title: string }> = {
  em_producao: { button: "Marcar em produção", title: "Marcar como em produção?" },
  enviado: { button: "Marcar enviado", title: "Marcar como enviado?" },
  entregue: { button: "Marcar entregue", title: "Marcar como entregue?" },
};

export const PRODUCT_LABEL: Record<string, string> = { album: "Álbum", caixa: "Caixa" };
export const REQUESTER_LABEL: Record<string, string> = { anfitriao: "anfitrião", convidado: "convidado" };

/** "65998124077" → "(65) 99812-4077". */
export function formatPhone(d: string | null | undefined): string {
  const n = (d ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d ?? "—";
}
export const formatCep = (c: string | null | undefined): string => ((c ?? "").replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") || "—");

export interface Shipping { cep?: string; street?: string; number?: string; complement?: string | null; neighborhood?: string; city?: string; state?: string }
/** "Rua das Mangueiras, 480, apto 62 · Jardim Itália · Cuiabá, MT · 78060-000". */
export function formatAddress(s: Shipping | null | undefined): string {
  if (!s) return "—";
  const street = [s.street, s.number, s.complement].filter((x) => x && String(x).trim()).join(", ");
  return [street, s.neighborhood, [s.city, s.state].filter(Boolean).join(", "), s.cep ? formatCep(s.cep) : ""].filter((x) => x && x.trim()).join(" · ") || "—";
}

export interface HistoryItem { status: PrintStatus; at: string; by: string; reason?: string | null }
export interface TimelineStep { tone: "ok" | "todo" | "bad"; label: string; caption?: string; reason?: string }
const STEPS: readonly PrintStatus[] = ["solicitado", "em_producao", "enviado", "entregue"];
const STEP_LABEL: Record<PrintStatus, string> = { solicitado: "Solicitado", em_producao: "Em produção", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };

/** Linha do tempo do desenho: os 4 passos; os alcançados com "quando · quem", os demais apagados. Cancelado termina em "Cancelado" (com o motivo). */
export function buildTimeline(history: readonly HistoryItem[], when: (iso: string) => string): TimelineStep[] {
  const by = new Map(history.map((h) => [h.status, h]));
  const line = (h: HistoryItem): string => `${when(h.at)} · ${h.by}`;
  const out: TimelineStep[] = [];
  const cancelled = by.get("cancelado");
  for (const s of STEPS) {
    const h = by.get(s);
    if (h) out.push({ tone: "ok", label: STEP_LABEL[s], caption: line(h) });
    else if (!cancelled) out.push({ tone: "todo", label: STEP_LABEL[s] });
  }
  if (cancelled) out.push({ tone: "bad", label: STEP_LABEL.cancelado, caption: line(cancelled), reason: cancelled.reason ?? undefined });
  return out;
}

/** Texto das fotos escolhidas: "48 fotos." / "1 foto.". */
export const photosText = (n: number): string => `${n} ${n === 1 ? "foto" : "fotos"}.`;
