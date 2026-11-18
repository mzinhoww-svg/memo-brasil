/**
 * Faixas de preço da página pública (home e /precos). Na home, o servidor lê o catálogo (`list_public_plans`) e revalida a cada
 * hora; qualquer falha, ou um catálogo sem plano pago, cai no fallback fixo, para que o Google nunca indexe a página sem preço.
 * O fallback espelha a migration 20261120000100_plans_faixas_convidados.sql.
 */
import type { PublicPlan } from "@/features/billing/types";
import { supabaseConfig } from "@/lib/supabase/env";

export type Tier = { code: string; label: string; price: string; priceCents: number; note: string; highlighted: boolean };

const NOTES: Record<string, string> = {
  gratis: "Para testar ou para um encontro pequeno. 10 poses por convidado.",
  ate150: "O tamanho da maioria dos casamentos. Menos de R$ 1 por convidado.",
  ate300: "Para festas grandes, com pista cheia até o fim.",
};

const brl = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`);

export function tiersFromPlans(plans: PublicPlan[]): Tier[] {
  return plans.map((p) => ({
    code: p.code,
    label: p.maxGuests === null ? "Convidados sem limite" : `Até ${p.maxGuests} convidados`,
    price: p.isFree ? "Grátis" : brl(p.priceCents),
    priceCents: p.priceCents,
    note: NOTES[p.code] ?? (p.maxShots === null ? "Poses livres por convidado." : `${p.maxShots} poses por convidado.`),
    highlighted: !!p.highlighted,
  }));
}

export const PRICING_FALLBACK: Tier[] = tiersFromPlans([
  { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, isFree: true, features: [] },
  { code: "ate150", name: "Até 150 convidados", maxGuests: 150, maxShots: 36, priceCents: 14700, isFree: false, features: [], highlighted: true },
  { code: "ate300", name: "Até 300 convidados", maxGuests: 300, maxShots: 36, priceCents: 29700, isFree: false, features: [] },
]);

type RawPlan = { code?: unknown; name?: unknown; maxGuests?: unknown; maxShots?: unknown; priceCents?: unknown; isFree?: unknown; highlighted?: unknown };
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Servidor: catálogo público com revalidação de 1 hora; nunca lança. */
export async function loadPublicTiers(): Promise<Tier[]> {
  const cfg = supabaseConfig();
  if (!cfg) return PRICING_FALLBACK;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/list_public_plans`, {
      method: "POST",
      headers: { apikey: cfg.key, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 3600 },
    } as RequestInit & { next: { revalidate: number } });
    if (!res.ok) return PRICING_FALLBACK;
    const raw = (await res.json()) as RawPlan[] | null;
    const plans: PublicPlan[] = (raw ?? []).map((p) => ({
      code: String(p.code), name: String(p.name), maxGuests: num(p.maxGuests), maxShots: num(p.maxShots),
      priceCents: num(p.priceCents) ?? 0, isFree: p.isFree === true, features: [], highlighted: p.highlighted === true,
    }));
    return plans.some((p) => !p.isFree) ? tiersFromPlans(plans) : PRICING_FALLBACK;
  } catch {
    return PRICING_FALLBACK;
  }
}
