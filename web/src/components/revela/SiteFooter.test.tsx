import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({ getPublicSettings: vi.fn() }));
vi.mock("@/features/billing/api", () => api);
import { SiteFooter } from "./SiteFooter";

const base = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "desligado", capacityGracePct: 10 };
beforeEach(() => { nav.path = "/"; api.getPublicSettings.mockReset(); });

describe("SiteFooter", () => {
  it("tem Termos, Privacidade e Ajuda, contato do servidor e assinatura; sem empresa quando vazia", async () => {
    api.getPublicSettings.mockResolvedValue({ ...base, supportEmail: "oi@memoriesmt.test" });
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Termos" })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
    expect(screen.getByRole("link", { name: "Ajuda" })).toHaveAttribute("href", "/ajuda");
    expect(await screen.findByRole("link", { name: "oi@memoriesmt.test" })).toBeInTheDocument();
    expect(screen.getByText("Revela")).toBeInTheDocument();
    expect(screen.queryByText(/CNPJ/)).toBeNull();
  });
  it("mostra razão social e CNPJ só quando preenchidos", async () => {
    api.getPublicSettings.mockResolvedValue({ ...base, companyLegalName: "Memórias Ltda", companyCnpj: "00.000.000/0001-00" });
    render(<SiteFooter />);
    expect(await screen.findByText(/Memórias Ltda/)).toBeInTheDocument();
    expect(screen.getByText(/CNPJ 00\.000\.000\/0001-00/)).toBeInTheDocument();
  });
  it("usa o contato padrão quando as configurações falham", async () => {
    api.getPublicSettings.mockRejectedValue(new Error("x"));
    render(<SiteFooter />);
    expect(await screen.findByRole("link", { name: /@/ })).toBeInTheDocument();
  });
  it("não aparece no app do convidado nem no painel", () => {
    api.getPublicSettings.mockResolvedValue(base);
    for (const p of ["/e/ABCD2345/agora", "/painel/x/plano", "/master"]) {
      nav.path = p;
      const { container, unmount } = render(<SiteFooter />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
