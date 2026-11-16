/** Pedido de impressão: servidor (RPCs `create_print_order`, `list_my_print_orders`, `cancel_print_order`) ou, no modo local, o aparelho (localStorage). Sem cobrança. */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { orderFromRow, digits, type PrintDraft, type PrintOrder } from "./model";

export class PrintOrderError extends Error {
  constructor(readonly code: "invalid" | "forbidden" | "ratelimited" | "estado" | "unknown") {
    super(code);
    this.name = "PrintOrderError";
  }
}
const CODES: Record<string, PrintOrderError["code"]> = { MM005: "invalid", MM004: "forbidden", MM006: "ratelimited", MM009: "estado" };
const fail = (e: { code?: string }): never => { throw new PrintOrderError(CODES[e.code ?? ""] ?? "unknown"); };

/** Texto para a pessoa a partir do erro. */
export function printErrorText(e: unknown): string {
  const c = e instanceof PrintOrderError ? e.code : "unknown";
  return c === "ratelimited" ? "Você fez muitos pedidos seguidos. Tente de novo mais tarde."
    : c === "forbidden" ? "Este pedido não é seu ou o evento não está disponível."
    : c === "invalid" ? "Confira os dados do pedido e as fotos escolhidas."
    : c === "estado" ? "Este pedido já está em produção e não pode mais ser cancelado."
    : "Não deu para enviar agora. Tente de novo.";
}

const KEY = "mm:print-orders:v1";
interface LocalRow extends Record<string, unknown> { requesterId: string }
function readLocal(): LocalRow[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeLocal(rows: LocalRow[]) { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* sem armazenamento: o pedido não fica guardado */ } }

export interface CreateArgs { id: string; eventId: string; eventTitle: string; userId: string; draft: PrintDraft; now: number }

export async function createPrintOrder(a: CreateArgs): Promise<PrintOrder> {
  const d = a.draft;
  if (backendMode() === "supabase") {
    const r = await browserSupabase().rpc("create_print_order", {
      p_id: a.id, p_event: a.eventId, p_product: d.product, p_quantity: d.quantity, p_photo_ids: d.allPhotos ? [] : d.photoIds, p_all_photos: d.allPhotos,
      p_contact_name: d.contactName.trim(), p_contact_phone: digits(d.contactPhone) || null, p_contact_email: d.contactEmail.trim() || null,
      p_shipping: { ...d.shipping, complement: d.shipping.complement?.trim() || undefined }, p_note: d.note.trim() || null,
    });
    if (r.error) return fail(r.error);
    return orderFromRow(r.data as Record<string, unknown>);
  }
  const rows = readLocal();
  const hit = rows.find((x) => x.id === a.id && x.requesterId === a.userId);
  if (hit) return orderFromRow({ ...hit, mine: true });
  const iso = new Date(a.now).toISOString();
  const row: LocalRow = {
    id: a.id, eventId: a.eventId, eventTitle: a.eventTitle, product: d.product, quantity: d.quantity, photoCount: d.allPhotos ? null : d.photoIds.length, allPhotos: d.allPhotos,
    contactName: d.contactName.trim(), contactPhone: digits(d.contactPhone) || null, contactEmail: d.contactEmail.trim() || null,
    shipping: { ...d.shipping, cep: digits(d.shipping.cep), state: d.shipping.state.trim().toUpperCase() }, note: d.note.trim() || null,
    status: "solicitado", requesterKind: "anfitriao", createdAt: iso, updatedAt: iso, requesterId: a.userId,
  };
  writeLocal([row, ...rows]);
  return orderFromRow({ ...row, mine: true });
}

/** Meus pedidos (e, para o anfitrião, os do evento). Sem `eventId`: todos os meus. */
export async function listMyPrintOrders(userId: string, eventId?: string): Promise<PrintOrder[]> {
  if (backendMode() === "supabase") {
    const r = await browserSupabase().rpc("list_my_print_orders", { p_event: eventId ?? null });
    if (r.error) return fail(r.error);
    return ((r.data ?? []) as Record<string, unknown>[]).map(orderFromRow);
  }
  return readLocal().filter((x) => x.requesterId === userId && (!eventId || x.eventId === eventId)).map((x) => orderFromRow({ ...x, mine: true }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function cancelPrintOrder(userId: string, id: string, now: number): Promise<PrintOrder> {
  if (backendMode() === "supabase") {
    const r = await browserSupabase().rpc("cancel_print_order", { p_id: id });
    if (r.error) return fail(r.error);
    return orderFromRow(r.data as Record<string, unknown>);
  }
  const rows = readLocal();
  const row = rows.find((x) => x.id === id && x.requesterId === userId);
  if (!row) throw new PrintOrderError("forbidden");
  if (row.status !== "solicitado" && row.status !== "cancelado") throw new PrintOrderError("estado");
  row.status = "cancelado"; row.updatedAt = new Date(now).toISOString();
  writeLocal(rows);
  return orderFromRow({ ...row, mine: true });
}
