import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/precos", useRouter: () => nav }));
const api = vi.hoisted(() => ({ listPublicPlans: vi.fn(), getPublicSettings: vi.fn() }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), ...api }));
import { PrecosView } from "./PrecosView";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const ALL = [P("gratis", "Grátis", 10, 10, 0, true), { ...P("ate150", "Até 150 convidados", 150, 36, 14700), highlighted: true }, P("ate300", "Até 300 convidados", 300, 36, 29700)];
const S = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 12 };
beforeEach(() => { Object.values(api).forEach((m) => m.mockReset()); nav.push.mockReset(); nav.back.mockReset(); });

describe("PrecosView (30 · Preços)", () => {
  it("três faixas por convidados, a de 150 em destaque, WhatsApp acima de 300 e CTA Criar evento grátis", async () => {
    api.listPublicPlans.mockResolvedValue(ALL); api.getPublicSettings.mockResolvedValue(S);
    render(<PrecosView />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Quantos convidados vão à festa?");
    expect(await screen.findByTestId("preco-ate150")).toHaveTextContent("R$ 147");
    expect(screen.getByTestId("preco-ate150")).toHaveClass("on");
    expect(screen.getByTestId("preco-ate150")).toHaveTextContent("Até 150 convidados");
    expect(screen.getByTestId("preco-ate300")).toHaveTextContent("R$ 297");
    expect(screen.getByTestId("preco-gratis")).toHaveTextContent("Grátis");
    expect(screen.getByTestId("preco-ate300")).not.toHaveClass("on");
    expect(screen.getByRole("link", { name: /Mais de 300 convidados\? Fale no WhatsApp/ })).toHaveAttribute("href", expect.stringContaining("https://wa.me/"));
    fireEvent.click(screen.getByRole("button", { name: /Criar evento grátis/ }));
    expect(nav.push).toHaveBeenCalledWith("/criar");
  });
  it("pagamentos desligados: só o Grátis, sem destaque, e avisa que os pagos voltam em breve", async () => {
    api.listPublicPlans.mockResolvedValue([ALL[0]]); api.getPublicSettings.mockResolvedValue({ ...S, paymentsEnv: "desligado" });
    render(<PrecosView />);
    expect(await screen.findByTestId("preco-gratis")).not.toHaveClass("on");
    expect(screen.queryByTestId("preco-festa")).toBeNull();
    expect(screen.getByText("Os planos pagos voltam em breve")).toBeInTheDocument();
  });
  it("catálogo indisponível: não inventa preços", async () => {
    api.listPublicPlans.mockRejectedValue(new Error("offline")); api.getPublicSettings.mockRejectedValue(new Error("offline"));
    render(<PrecosView />);
    expect(await screen.findByText("Não deu para carregar os preços agora")).toBeInTheDocument();
    expect(screen.queryByTestId("preco-gratis")).toBeNull();
  });
});
