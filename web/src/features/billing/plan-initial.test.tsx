import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), quote: vi.fn(async () => ({ planCode: "festa", fromPlanCode: null, amountCents: 2900, payable: true, reason: "ok" })) }));
import { PlanPicker } from "./PlanPicker";
import type { PublicPlan, PublicSettings } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("casamento", "Casamento", 250, 36, 18900)];
const S: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };

describe("PlanPicker initialPlan", () => {
  it("pré-seleciona o plano de ?plano=", () => {
    render(<PlanPicker eventId="e" plans={PLANS} currentCode="gratis" settings={S} busy={false} onPay={() => undefined} onRedeemed={() => undefined} initialPlan="festa" />);
    expect(screen.getByRole("radio", { name: /Até 30/ })).toBeChecked();
  });
  it("plano desconhecido cai no recomendado", () => {
    render(<PlanPicker eventId="e" plans={PLANS} currentCode="gratis" settings={S} busy={false} onPay={() => undefined} onRedeemed={() => undefined} initialPlan="xyz" />);
    expect(screen.getByRole("radio", { name: /Até 250/ })).toBeChecked();
  });
});
