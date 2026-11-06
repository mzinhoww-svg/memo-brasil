/** Exact BRL boundary. Limits match PostgreSQL integer amount_cents. No rounding. */
const MAX_CENTS = BigInt(2_147_483_647);
const HUNDRED = BigInt(100);

export function centsToReais(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > Number(MAX_CENTS)) {
    throw new Error("invalid_amount_cents");
  }
  const n = BigInt(cents);
  return `${n / HUNDRED}.${String(n % HUNDRED).padStart(2, "0")}`;
}

export function reaisToCents(reais: string | number): number {
  const text = String(reais);
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text) || text.length > 16) {
    throw new Error("invalid_amount_reais");
  }
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
  if (cents > MAX_CENTS) throw new Error("invalid_amount_reais");
  return Number(cents);
}
