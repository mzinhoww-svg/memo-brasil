import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/precos", useRouter: () => nav }));
const api = vi.hoisted(() => ({ listPublicPlans: vi.fn(), getPublicSettings: vi.fn() }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), ...api }));
import { PrecosView } from "./PrecosView";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const ALL = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const S = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 12 };
beforeEach(() => { Object.values(api).forEach((m) => m.mockReset()); nav.push.mockReset(); nav.back.mockReset(); });

describe("PrecosView (30 · Preços)", () => {
  it("mostra os 5 planos do catálogo, Casamento destacado e o CTA Montar câmera", async () => {
    api.listPublicPlans.mockResolvedValue(ALL); api.getPublicSettings.mockResolvedValue(S);
    render(<PrecosView />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Um preçopor festa.");
    expect(await screen.findByTestId("preco-casamento")).toHaveTextContent("R$ 189");
    expect(screen.getByTestId("preco-casamento")).toHaveClass("on");
    expect(screen.getByTestId("preco-casamento")).toHaveTextContent("250 convidados · 36 poses cada");
    for (const [c, v] of [["gratis", "R$ 0"], ["festa", "R$ 29"], ["celebracao", "R$ 89"], ["grande", "R$ 349"]]) expect(screen.getByTestId(`preco-${c}`)).toHaveTextContent(v);
    expect(screen.getByTestId("preco-grande")).toHaveTextContent("poses livres");
    expect(screen.getByTestId("preco-festa")).not.toHaveClass("on");
    fireEvent.click(screen.getByRole("button", { name: /Montar câmera/ }));
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
