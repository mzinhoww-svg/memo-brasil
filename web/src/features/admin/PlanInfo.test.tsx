import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
import { CapacityBanner, PlanSummaryCard, PreEventChecklist } from "./PlanInfo";

describe("PlanInfo (painel)", () => {
  it("cartão Plano: plano atual, uso e botão Aumentar para /plano", () => {
    render(<PlanSummaryCard planName="Casamento" guests={212} capacity={250} planHref="/painel/e1/plano" canUpgrade />);
    expect(screen.getByText("Casamento")).toBeInTheDocument();
    expect(screen.getByText("212 de 250 convidados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aumentar" })).toHaveAttribute("href", "/painel/e1/plano");
  });
  it("sem upgrade possível não mostra Aumentar", () => {
    render(<PlanSummaryCard planName="Grande" guests={3} capacity={null} planHref="/x" canUpgrade={false} />);
    expect(screen.queryByRole("link", { name: "Aumentar" })).toBeNull();
    expect(screen.getByText("3 convidados, sem limite")).toBeInTheDocument();
  });
  it("banner de tolerância com a frase do plano", () => {
    render(<CapacityBanner guests={212} capacity={250} limit={275} planHref="/p" />);
    expect(screen.getByText(/Lotação chegando: 212 de 250\./)).toBeInTheDocument();
    expect(screen.getByText(/Ninguém será barrado até 275\./)).toBeInTheDocument();
  });
  it("checklist: criado feito; plano só com pedido pendente", () => {
    const { rerender } = render(<PreEventChecklist eventId="e1" eventCode="ABCD2345" hasPhoto={false} order={null} />);
    expect(screen.getByText("Evento criado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tire a primeira foto como convidado/ })).toHaveAttribute("href", "/e/ABCD2345");
    expect(screen.getByRole("link", { name: /Imprima os cards/ })).toHaveAttribute("href", "/painel/e1/qr");
    expect(screen.queryByText(/Pague o plano/)).toBeNull();
    rerender(<PreEventChecklist eventId="e1" eventCode="ABCD2345" hasPhoto order={{ orderId: "o", status: "pendente", planCode: "casamento", amountCents: 18900, provider: "mercadopago" }} />);
    expect(screen.getByRole("link", { name: /Conclua o pagamento do plano · R\$ 189,00/ })).toHaveAttribute("href", "/painel/e1/plano");
  });
});
