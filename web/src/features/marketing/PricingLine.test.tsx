import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listPublicPlans: vi.fn(), getPublicSettings: vi.fn() }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), ...api }));
import { LivePricingLine, PricingLine } from "./PricingLine";

const P = (code: string, cents: number, free = false) => ({ code, name: code, maxGuests: 10, maxShots: 10, priceCents: cents, isFree: free, features: [] });
beforeEach(() => { Object.values(api).forEach((m) => m.mockReset()); api.getPublicSettings.mockResolvedValue({ supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 }); });

describe("PricingLine", () => {
  it("sem fromPrice, só a frase grátis", () => {
    render(<PricingLine />);
    expect(screen.getByTestId("linha-preco")).toHaveTextContent(/^Grátis até 10 convidados\.$/);
  });
  it("LivePricingLine: com pagos ativos usa o menor preço do catálogo", async () => {
    api.listPublicPlans.mockResolvedValue([P("gratis", 0, true), P("casamento", 18900), P("festa", 2900)]);
    render(<LivePricingLine />);
    expect(await screen.findByText(/Planos a partir de R\$ 29,00, pagos uma vez por evento\./)).toBeInTheDocument();
  });
  it("LivePricingLine: só Grátis não menciona planos", async () => {
    api.listPublicPlans.mockResolvedValue([P("gratis", 0, true)]);
    render(<LivePricingLine />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("linha-preco")).toHaveTextContent(/^Grátis até 10 convidados\.$/);
  });
});
