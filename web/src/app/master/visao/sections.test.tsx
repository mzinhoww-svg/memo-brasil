import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { Kpis, Readiness, Routines } from "./sections";
import { toOverview } from "./lib";

const READY = { companyCnpj: true, companyLegalName: true, supportEmail: true, supportPhone: true, paymentsEnv: "production", lastWebhookAt: "2026-10-01T00:00:00Z" };

describe("Visão geral", () => {
  it("receita nula mostra Só master; outros KPIs com delta", () => {
    render(<Kpis o={toOverview({ days: 30, kpis: { activeEvents: { value: 12, previous: 10, spark: [1, 2] }, participants: { value: 5, previous: 5, spark: [] }, photos: { value: 0, previous: 0, spark: [] }, revenueCents: { value: null, previous: null, spark: [] } } })} />);
    expect(screen.getByText("Só master")).toBeInTheDocument();
    expect(screen.getByText("Receita 30 dias")).toBeInTheDocument();
    expect(screen.getByText(/\+20%/)).toBeInTheDocument();
  });
  it("card Pronto para produção some quando tudo ok", () => {
    const { container, rerender } = render(<Readiness r={READY} sp={{}} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Readiness r={{ ...READY, paymentsEnv: "sandbox" }} sp={{}} />);
    expect(screen.getByText("Pronto para produção")).toBeInTheDocument();
    expect(screen.getByText("faltam 1")).toBeInTheDocument();
  });
  it("mapa de rotinas com estado textual", () => {
    render(<Routines jobs={[{ name: "mm-a", ok: true }, { name: "mm-b", ok: false }]} sp={{ testes: "1" }} />);
    expect(screen.getByText("1 com falha")).toBeInTheDocument();
    expect(screen.getByText(": falhou")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Saúde/ })).toHaveAttribute("href", "/master/saude?testes=1");
  });
});
