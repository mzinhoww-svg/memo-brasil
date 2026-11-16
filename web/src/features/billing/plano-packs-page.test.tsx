import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({
  quote: vi.fn(), startCheckout: vi.fn(), openOrder: vi.fn(), listPublicPlans: vi.fn(), listPosePacks: vi.fn(), getPublicSettings: vi.fn(),
}));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), ...api }));
const ent = vi.hoisted(() => ({ code: "festa" }));
vi.mock("./entitlement", () => ({ currentPlanCode: vi.fn(async () => ent.code) }));
const nav = vi.hoisted(() => ({ goToCheckout: vi.fn(), redirect: vi.fn(), search: "" }));
vi.mock("./checkout-nav", async (orig) => ({ ...(await orig<typeof import("./checkout-nav")>()), goToCheckout: nav.goToCheckout }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => nav.redirect(url), useSearchParams: () => new URLSearchParams(nav.search), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/admin/context", () => ({ useAdmin: () => ({ event: { id: "ev1", title: "Ana & Rui", shotsPerPerson: 36 }, refresh: vi.fn(), participants: [] }) }));

import PlanoPage from "@/app/painel/[id]/plano/page";
import type { PosePack, PublicPlan, PublicSettings } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 50, 24, 5990), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900)];
const PACKS: PosePack[] = [
  { code: "festa_36", baseCode: "festa", name: "Festa + Mais poses", maxGuests: 50, maxShots: 36, baseMaxShots: 24, priceCents: 7980, extraCents: 1990, available: true },
];
const SETTINGS: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };

beforeEach(() => {
  sessionStorage.clear(); Object.values(api).forEach((m) => m.mockReset()); nav.goToCheckout.mockReset(); nav.redirect.mockReset(); nav.search = "";
  window.history.replaceState(null, "", "/painel/ev1/plano");
  api.listPublicPlans.mockResolvedValue(PLANS); api.listPosePacks.mockResolvedValue(PACKS); api.getPublicSettings.mockResolvedValue(SETTINGS); api.openOrder.mockResolvedValue(null);
  api.quote.mockImplementation(async (_e: string, code: string) => ({ planCode: code, fromPlanCode: "festa", amountCents: code === "festa_36" ? 1990 : 12910, payable: true, reason: "ok" }));
  vi.stubEnv("NEXT_PUBLIC_VALIDAPAY_CHECKOUT", "1");
});
afterEach(() => vi.unstubAllEnvs());

describe("painel · Plano com o pacote Mais poses (checkout ValidaPay)", () => {
  it("Festa sem pacote: cartão 'Mais poses' com R$ 19,90; adicionar abre o checkout normal da variante", async () => {
    ent.code = "festa";
    render(<PlanoPage />);
    expect(await screen.findByTestId("cartao-mais-poses")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar Mais poses · R$ 19,90" }));
    await waitFor(() => expect(nav.redirect).toHaveBeenCalledWith("/painel/ev1/checkout-validapay?plano=festa_36"));
  });
  it("quem tem o pacote (direito festa_36) aparece como Festa + Mais poses, 36 poses, e não vê o cartão", async () => {
    ent.code = "festa_36";
    render(<PlanoPage />);
    expect(await screen.findByText("Festa + Mais poses · R$ 79,80")).toBeInTheDocument();
    expect(screen.getByText("36 de 36")).toBeInTheDocument(); // medidor de poses usa o limite do pacote
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
    // o direito é a variante, mas o seletor segue com os planos normais: Festa aparece como o plano atual
    expect(screen.queryByRole("radio", { name: /Mais poses/ })).toBeNull();
  });
  it("Grátis: sem cartão", async () => {
    ent.code = "gratis";
    render(<PlanoPage />);
    await screen.findAllByRole("radio");
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
  });
  it("falha ao listar pacotes não derruba a tela: Festa sem cartão", async () => {
    ent.code = "festa";
    api.listPosePacks.mockResolvedValue([]);
    render(<PlanoPage />);
    await screen.findAllByRole("radio");
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
  });
});
