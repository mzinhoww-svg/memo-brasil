import type { PublicPlan } from "./types";

/**
 * Recommendation is display-only. Availability, price, quote and entitlement
 * remain authoritative in the existing Supabase billing RPCs.
 */
export function salePlans(plans: PublicPlan[]): PublicPlan[] {
  return [...plans]
    .filter((p) => !/^teste/i.test(p.code) && Number.isFinite(p.priceCents) && p.priceCents >= 0)
    .sort((a, b) => (a.maxGuests ?? Infinity) - (b.maxGuests ?? Infinity));
}

export function recommendForGuests(plans: PublicPlan[], guests: number): PublicPlan | null {
  if (!Number.isFinite(guests) || guests < 1) return null;
  return salePlans(plans).find((p) => p.maxGuests === null || p.maxGuests >= guests) ?? null;
}

export function guestsInput(v: string | null, fallback = 30): number {
  const n = Number(v);
  return v && Number.isSafeInteger(n) && n >= 1 && n <= 100000 ? n : fallback;
}

export function planSupports(plan: PublicPlan | undefined, guests: number): boolean {
  return Boolean(plan && (plan.maxGuests === null || plan.maxGuests >= guests));
}

export function isUpgrade(plans: PublicPlan[], currentCode: string, targetCode: string): boolean {
  const all = salePlans(plans);
  return all.findIndex((p) => p.code === targetCode) > all.findIndex((p) => p.code === currentCode);
}
