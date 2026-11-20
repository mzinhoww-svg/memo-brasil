/** GF-01 · Somente métricas agregadas. Retorno de public.admin_growth_cohort. */
import { conversionRate } from "./taxonomy";

export interface GrowthCohort {
  days: number;
  timezone: "America/Cuiaba";
  from: string;
  toExclusive: string;
  generatedAt: string;
  totals: {
    created: number;
    withGuests: number;
    withPhotos: number;
    activated: number;
    checkoutEvents: number;
    paidEvents: number;
    courtesyEvents: number;
    paidOrders: number;
    paidCents: number;
    reversedOrDisputedOrders: number;
  };
  series: Array<{
    day: string;
    created: number;
    activated: number;
    checkoutEvents: number;
    paidEvents: number;
  }>;
}

export const COHORT_PERIODS = [7, 30, 90] as const;
export type CohortPeriod = (typeof COHORT_PERIODS)[number];

export function parseCohortPeriod(raw?: string): CohortPeriod {
  const n = Number(raw);
  return COHORT_PERIODS.includes(n as CohortPeriod) ? n as CohortPeriod : 30;
}

const num = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatGrowthCount = (value: number) => num.format(value);
export const formatGrowthMoney = (cents: number) => money.format(cents / 100);

/** Exibe — quando o denominador é 0 ou as coortes não são consistentes. */
export function formatGrowthRate(successes: number, opportunities: number): string {
  const result = conversionRate(successes, opportunities);
  return result === null ? "—" : `${(result * 100).toFixed(1).replace(".", ",")}%`;
}
