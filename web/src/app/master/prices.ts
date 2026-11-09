/** Lógica pura da tela M03/M04 (preços editáveis): rascunho, diferenças, validação e o payload de admin_publish_plans. */
import { brl } from "./billing";

export interface PlanRow {
  code: string;
  name: string;
  maxGuests: number | null;
  maxShots: number | null;
  priceCents: number;
  sandboxActive: boolean;
  productionActive: boolean;
  highlighted: boolean;
  isFree: boolean;
  sort: number;
  isNew?: boolean;
}

export const CODE_RE = /^[a-z][a-z0-9_]{1,31}$/;
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 10_000_000;

export const slugify = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 32);

const FIELDS = ["name", "maxGuests", "maxShots", "priceCents", "sandboxActive", "productionActive", "highlighted"] as const;
export type Field = (typeof FIELDS)[number];

export interface PlanDiff { code: string; name: string; isNew: boolean; changes: { field: Field; from: PlanRow[Field] | null; to: PlanRow[Field] }[] }

/** Diferenças entre o que está no banco e o rascunho. Plano novo: todos os campos entram. */
export function diffPlans(original: PlanRow[], draft: PlanRow[]): PlanDiff[] {
  const byCode = new Map(original.map((p) => [p.code, p]));
  const out: PlanDiff[] = [];
  for (const d of draft) {
    const o = byCode.get(d.code);
    if (!o) { out.push({ code: d.code, name: d.name, isNew: true, changes: FIELDS.map((f) => ({ field: f, from: null, to: d[f] })) }); continue; }
    const changes = FIELDS.filter((f) => o[f] !== d[f]).map((f) => ({ field: f, from: o[f], to: d[f] }));
    if (changes.length) out.push({ code: d.code, name: d.name, isNew: false, changes });
  }
  return out;
}

export function draftErrors(draft: PlanRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const p of draft) {
    if (seen.has(p.code)) errors[p.code] = "Já existe um plano com este código.";
    seen.add(p.code);
    if (p.isNew && !CODE_RE.test(p.code)) errors[p.code] = "Código: letras minúsculas, números e _, começando por letra.";
    else if (!p.name.trim()) errors[p.code] = "Dê um nome ao plano.";
    else if (!p.isFree && (p.priceCents < MIN_PRICE_CENTS || p.priceCents > MAX_PRICE_CENTS)) errors[p.code] = "Preço entre R$ 1,00 e R$ 100.000,00.";
    else if (p.maxGuests != null && (p.maxGuests < 1 || p.maxGuests > 1000)) errors[p.code] = "Convidados: de 1 a 1.000 (vazio = sem limite).";
    else if (p.maxShots != null && (p.maxShots < 1 || p.maxShots > 1000)) errors[p.code] = "Poses: de 1 a 1.000 (vazio = sem limite).";
  }
  if (draft.filter((p) => p.highlighted).length > 1) errors["_destaque"] = "Só um plano pode ficar em destaque.";
  return errors;
}

/** Marcar um plano como destaque desmarca os outros (no máximo um). */
export function setHighlight(draft: PlanRow[], code: string | null): PlanRow[] {
  return draft.map((p) => ({ ...p, highlighted: p.code === code }));
}

/** Corpo de admin_publish_plans: só planos que mudaram (o servidor também ignora os iguais). */
export function toChanges(original: PlanRow[], draft: PlanRow[]) {
  const changed = new Set(diffPlans(original, draft).map((d) => d.code));
  // o destaque vale para o conjunto todo: se mudou em qualquer plano, entram os dois lados da troca
  return draft.filter((p) => changed.has(p.code)).map((p) => ({
    code: p.code, name: p.name.trim(), priceCents: p.priceCents, maxGuests: p.maxGuests, maxShots: p.maxShots,
    sandboxActive: p.sandboxActive, productionActive: p.productionActive, highlighted: p.highlighted, ...(p.isNew ? { isNew: true } : {}),
  }));
}

const lim = (v: unknown) => (v == null ? "sem limite" : String(v));
const yn = (v: unknown) => (v ? "ligado" : "desligado");
export const FIELD_LABEL: Record<Field, string> = { name: "Nome", maxGuests: "Convidados", maxShots: "Poses por pessoa", priceCents: "Preço", sandboxActive: "Sandbox", productionActive: "Produção", highlighted: "Destaque no paywall" };
export function showValue(field: Field, v: unknown): string {
  if (field === "priceCents") return brl(Number(v));
  if (field === "maxGuests" || field === "maxShots") return lim(v);
  if (field === "sandboxActive" || field === "productionActive" || field === "highlighted") return yn(v);
  return String(v ?? "—");
}

/** Texto do impacto, sempre o mesmo contrato: o preço novo vale só para pedidos novos. */
export const IMPACT_TEXT = "Eventos já pagos mantêm os limites que compraram. Pix já aberto mantém o valor cotado. O novo preço vale para pedidos criados depois da publicação.";
