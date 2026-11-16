/** Pedido de impressão (19b): tipos, produtos do desenho e validação do formulário (as mesmas regras do servidor, `create_print_order`). Sem cobrança. */

export type PrintProduct = "album" | "caixa";
export type PrintStatus = "solicitado" | "em_producao" | "enviado" | "entregue" | "cancelado";

/** Produtos da tela 19b. `max` é o teto de fotos escolhidas (ou todas). */
export const PRODUCTS: Record<PrintProduct, { label: string; meta: string; max: number }> = {
  album: { label: "Capa de linho marfim", meta: "21 × 21 cm · 60 fotos", max: 60 },
  caixa: { label: "Caixa com 30 fotos soltas", meta: "10 × 15 cm, borda branca", max: 30 },
};
export const STATUS_LABEL: Record<PrintStatus, string> = {
  solicitado: "Pedido enviado", em_producao: "Em produção", enviado: "A caminho", entregue: "Entregue", cancelado: "Cancelado",
};
export const QUANTITY_MAX = 10;

export interface Shipping { cep: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string }
export interface PrintOrder {
  id: string; eventId: string | null; eventTitle: string; product: PrintProduct; quantity: number;
  /** null quando o pedido é de "todas as fotos" */
  photoCount: number | null; allPhotos: boolean;
  contactName: string; contactPhone: string | null; contactEmail: string | null; shipping: Shipping; note: string | null;
  status: PrintStatus; mine: boolean; requesterKind: "anfitriao" | "convidado"; createdAt: number; updatedAt: number;
}
export interface PrintDraft {
  product: PrintProduct; quantity: number; photoIds: string[]; allPhotos: boolean;
  contactName: string; contactPhone: string; contactEmail: string; shipping: Shipping; note: string;
}
export type DraftErrors = Partial<Record<"photos" | "quantity" | "contactName" | "contact" | "cep" | "street" | "number" | "neighborhood" | "city" | "state" | "note", string>>;

export const digits = (s: string) => s.replace(/\D/g, "");
export const emptyShipping = (): Shipping => ({ cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });

/** "65999991234" → "(65) 99999-1234"; incompleto devolve o que há. */
export function formatPhone(raw: string): string {
  const d = digits(raw).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length <= 2) return d ? `(${d}` : "";
  const ddd = d.slice(0, 2), rest = d.slice(2);
  const cut = rest.length > 8 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, cut)}${rest.length > cut ? `-${rest.slice(cut, cut + 4)}` : ""}`;
}
/** "78000000" → "78000-000" */
export function formatCep(raw: string): string {
  const d = digits(raw).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const len = (s: string, min: number, max: number) => { const n = s.trim().length; return n >= min && n <= max; };

/** Erros do formulário em português, dizendo o que fazer. Vazio = pode enviar. */
export function validateDraft(d: PrintDraft): DraftErrors {
  const e: DraftErrors = {};
  const max = PRODUCTS[d.product].max;
  if (!d.allPhotos && (d.photoIds.length < 1 || d.photoIds.length > max)) e.photos = d.photoIds.length < 1 ? "Escolha pelo menos uma foto, ou use todas." : `Este produto leva até ${max} fotos.`;
  if (!Number.isInteger(d.quantity) || d.quantity < 1 || d.quantity > QUANTITY_MAX) e.quantity = `Escolha de 1 a ${QUANTITY_MAX}.`;
  if (!len(d.contactName, 2, 80)) e.contactName = "Diga seu nome (2 a 80 letras).";
  const phone = digits(d.contactPhone), email = d.contactEmail.trim();
  if (phone && (phone.length < 10 || phone.length > 13)) e.contact = "Telefone com DDD, por exemplo (65) 99999-1234.";
  else if (email && (email.length > 254 || !EMAIL.test(email))) e.contact = "Confira o e-mail.";
  else if (!phone && !email) e.contact = "Informe um telefone ou um e-mail para falarmos com você.";
  const s = d.shipping;
  if (digits(s.cep).length !== 8) e.cep = "CEP com 8 números.";
  if (!len(s.street, 3, 120)) e.street = "Informe a rua.";
  if (!len(s.number, 1, 20)) e.number = "Informe o número (ou s/n).";
  if (!len(s.neighborhood, 2, 80)) e.neighborhood = "Informe o bairro.";
  if (!len(s.city, 2, 80)) e.city = "Informe a cidade.";
  if (!/^[A-Za-z]{2}$/.test(s.state.trim())) e.state = "UF com 2 letras.";
  if (d.note.trim().length > 500) e.note = "Até 500 letras.";
  return e;
}

/** Linha do servidor (JSON de `create_print_order` / `list_my_print_orders`) → pedido do app. Valores fora do esperado viram o padrão mais seguro. */
export function orderFromRow(r: Record<string, unknown>): PrintOrder {
  const sh = (r.shipping ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const status = (["solicitado", "em_producao", "enviado", "entregue", "cancelado"] as const).find((s) => s === r.status) ?? "solicitado";
  return {
    id: str(r.id), eventId: typeof r.eventId === "string" ? r.eventId : null, eventTitle: str(r.eventTitle), product: r.product === "caixa" ? "caixa" : "album",
    quantity: Number(r.quantity ?? 1), photoCount: r.photoCount == null ? null : Number(r.photoCount), allPhotos: r.allPhotos === true,
    contactName: str(r.contactName), contactPhone: typeof r.contactPhone === "string" ? r.contactPhone : null, contactEmail: typeof r.contactEmail === "string" ? r.contactEmail : null,
    shipping: { cep: str(sh.cep), street: str(sh.street), number: str(sh.number), complement: str(sh.complement) || undefined, neighborhood: str(sh.neighborhood), city: str(sh.city), state: str(sh.state) },
    note: typeof r.note === "string" ? r.note : null, status, mine: r.mine === true, requesterKind: r.requesterKind === "convidado" ? "convidado" : "anfitriao",
    createdAt: Date.parse(str(r.createdAt)) || 0, updatedAt: Date.parse(str(r.updatedAt)) || 0,
  };
}

/** "2 álbuns · 12 fotos" / "1 caixa · todas as fotos" */
export function orderSummary(o: Pick<PrintOrder, "product" | "quantity" | "photoCount" | "allPhotos">): string {
  const item = o.product === "album" ? (o.quantity === 1 ? "álbum" : "álbuns") : (o.quantity === 1 ? "caixa" : "caixas");
  const photos = o.allPhotos ? "todas as fotos" : `${o.photoCount ?? 0} ${o.photoCount === 1 ? "foto" : "fotos"}`;
  return `${o.quantity} ${item} · ${photos}`;
}
