import { describe, expect, it } from "vitest";
import {
  GROWTH_EVENTS,
  GROWTH_FUNNEL,
  GROWTH_TAXONOMY_VERSION,
  conversionRate,
  isGrowthEventName,
  isVerifiedPayment,
} from "./taxonomy";

describe("growth taxonomy", () => {
  it("keeps the funnel order stable and versioned", () => {
    expect(GROWTH_TAXONOMY_VERSION).toBe(1);
    expect(GROWTH_FUNNEL.map((x) => x.event)).toEqual([
      "page_viewed", "signup_completed", "event_created", "checkout_started", "payment_approved",
    ]);
    expect(GROWTH_FUNNEL.every((x) => isGrowthEventName(x.event))).toBe(true);
  });

  it("rejects unexpected/unsafe event names", () => {
    expect(isGrowthEventName("payment_approved")).toBe(true);
    expect(isGrowthEventName("email")).toBe(false);
    expect(isGrowthEventName("__proto__")).toBe(false);
    expect(isGrowthEventName(null)).toBe(false);
    expect(isGrowthEventName({})).toBe(false);
  });

  it("requires trusted confirmation for a paid conversion", () => {
    expect(GROWTH_EVENTS.payment_approved.origin).toBe("provider");
    expect(isVerifiedPayment("payment_approved", "provider")).toBe(true);
    expect(isVerifiedPayment("payment_approved", "browser")).toBe(false);
    expect(isVerifiedPayment("checkout_started", "provider")).toBe(false);
  });

  it("does not manufacture conversion rates from invalid/mixed cohorts", () => {
    expect(conversionRate(2, 10)).toBe(0.2);
    expect(conversionRate(0, 10)).toBe(0);
    expect(conversionRate(0, 0)).toBeNull();
    expect(conversionRate(11, 10)).toBeNull();
    expect(conversionRate(-1, 10)).toBeNull();
    expect(conversionRate(Number.NaN, 10)).toBeNull();
    expect(conversionRate(1, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
