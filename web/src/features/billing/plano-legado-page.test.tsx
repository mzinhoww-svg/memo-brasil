import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("./checkout-provider", () => ({ validapayCheckoutEnabled: () => false }));
const api = vi.hoisted(() => ({ quote: vi.fn(), openOrder: vi.fn(), listPublicPlans: vi.fn(), getPublicSettings: vi.fn(), listPosePacks: vi.fn() }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), ...api }));
// evento que pagou "Casamento" (250): o plano saiu do catálogo público depois das faixas por convidados
const CASAMENTO = { code: "casamento", name: "Casamento", maxGuests: 250, maxShots: 36, priceCents: 18900, isFree: false, features: [] };
vi.mock("./entitlement", () => ({ currentPlanCode: vi.fn(async () => "casamento"), currentPlan: vi.fn(async () => CASAMENTO) }));
vi.mock("@/features/admin/context", () => ({ useAdmin: () => ({ event: { id: "ev1", title: "Ana & Rui" }, refresh: vi.fn() }) }));

import PlanoPage from "@/app/painel/[id]/plano/page";
import { usePlanInfo } from "@/features/admin/PlanInfo";

const P = (code: string, name: string, g: number, s: number, cents: number, extra = {}) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: cents === 0, features: [], ...extra });
const CATALOG = [P("gratis", "Grátis", 10, 10, 0), P("ate150", "Até 150 convidados", 150, 36, 14700, { highlighted: true }), P("ate300", "Até 300 convidados", 300, 36, 29700)];

beforeEach(() => {
  api.listPublicPlans.mockResolvedValue(CATALOG);
  api.getPublicSettings.mockResolvedValue({ supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 });
  api.openOrder.mockResolvedValue(null);
  api.listPosePacks.mockResolvedValue([]);
  api.quote.mockResolvedValue({ planCode: "ate300", fromPlanCode: "casamento", amountCents: 10800, payable: true, reason: "ok" });
});

describe("evento com plano antigo fora do catálogo público", () => {
  it("página do plano: oferece só a faixa maior (Até 300), nunca a de 150", async () => {
    render(<PlanoPage />);
    expect(await screen.findByRole("radio", { name: /Até 300/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Até 150/ })).toBeDisabled();
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(api.quote).not.toHaveBeenCalledWith("ev1", "ate150");
  });
  it("resumo do plano no painel: Casamento com 250 convidados, não o Grátis", async () => {
    const { result } = renderHook(() => usePlanInfo("ev1"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.current).toMatchObject({ name: "Casamento", maxGuests: 250, maxShots: 36 });
  });
});
