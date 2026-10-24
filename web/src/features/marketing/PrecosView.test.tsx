import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/precos" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({ listPublicPlans: vi.fn(), getPublicSettings: vi.fn() }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), ...api }));
import { PrecosView } from "./PrecosView";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const ALL = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const S = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 12 };
beforeEach(() => Object.values(api).forEach((m) => m.mockReset()));

describe("PrecosView", () => {
  it("mostra os 5 planos do catálogo, Casamento destacado, perguntas e CTA", async () => {
    api.listPublicPlans.mockResolvedValue(ALL); api.getPublicSettings.mockResolvedValue(S);
    render(<PrecosView />);
    expect(screen.getByRole("heading", { level: 1, name: "Um preço por festa. Sem assinatura." })).toBeInTheDocument();
    expect(await screen.findByTestId("preco-casamento")).toHaveTextContent("R$ 189,00");
    expect(screen.getByTestId("preco-casamento")).toHaveTextContent("Recomendado");
    for (const [c, v] of [["festa", "R$ 29,00"], ["celebracao", "R$ 89,00"], ["grande", "R$ 349,00"]]) expect(screen.getByTestId(`preco-${c}`)).toHaveTextContent(v);
    expect(screen.getByText(/até 12% de convidados além do limite/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Posso pedir reembolso?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
    expect(screen.queryByText("Fale com a gente", { selector: "h2" })).toBeNull();
    expect(screen.queryByText(/7 dias/)).toBeNull();
  });
  it("pagamentos desligados: só o Grátis e Fale com a gente", async () => {
    api.listPublicPlans.mockResolvedValue([ALL[0]]); api.getPublicSettings.mockResolvedValue({ ...S, paymentsEnv: "desligado" });
    render(<PrecosView />);
    expect(await screen.findByTestId("preco-gratis")).toBeInTheDocument();
    expect(screen.queryByTestId("preco-festa")).toBeNull();
    expect(screen.getByRole("link", { name: "Fale com a gente" })).toHaveAttribute("href", expect.stringContaining("mailto:oi@memoriesmt.test"));
    expect(screen.queryByText("Recomendado")).toBeNull();
    expect(screen.getByText(/Os planos pagos ainda não estão abertos/)).toBeInTheDocument();
    expect(screen.queryByText(/O plano libera assim que o pagamento for confirmado/)).toBeNull();
  });
  it("planos pagos abertos: a FAQ explica o pagamento no Mercado Pago", async () => {
    api.listPublicPlans.mockResolvedValue(ALL); api.getPublicSettings.mockResolvedValue(S);
    render(<PrecosView />);
    expect(await screen.findByTestId("preco-festa")).toBeInTheDocument();
    expect(screen.getByText(/O plano libera assim que o pagamento for confirmado/)).toBeInTheDocument();
    expect(screen.queryByText(/ainda não estão abertos/)).toBeNull();
  });
});
