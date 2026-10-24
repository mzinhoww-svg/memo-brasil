import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicPlan, PublicSettings } from "@/features/billing/types";
import { PAID_PLAN_LINE, PlanStep } from "./PlanStep";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const ALL = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("casamento", "Casamento", 250, 36, 18900)];
const S: PublicSettings = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };

describe("PlanStep (passo 4)", () => {
  it("mostra os cartões do catálogo, marca o escolhido e mostra o TrustBlock dele", () => {
    const onSelect = vi.fn();
    render(<PlanStep plans={ALL} settings={S} selected="casamento" onSelect={onSelect} pendingCode={null} />);
    expect(screen.getByRole("radio", { name: /Até 250 · R\$ 189,00/ })).toBeChecked();
    expect(screen.getByText("250 olhares por R$ 0,76 cada.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Até 30 · R\$ 29,00/ }));
    expect(onSelect).toHaveBeenCalledWith("festa");
    expect(screen.queryByText(/Fale com a gente/)).toBeNull();
  });
  it("sem plano pago ativo mostra 'Fale com a gente' com o e-mail de suporte", () => {
    render(<PlanStep plans={[ALL[0]]} settings={S} selected="gratis" onSelect={() => undefined} pendingCode={null} />);
    expect(screen.getByRole("link", { name: /Fale com a gente/ })).toHaveAttribute("href", expect.stringContaining("mailto:oi@memoriesmt.test"));
  });
  it("mostra o código que será aplicado ao criar", () => {
    render(<PlanStep plans={ALL} settings={S} selected="gratis" onSelect={() => undefined} pendingCode="MMT-7KQ4-AB12" />);
    expect(screen.getByText("Código MMT-7KQ4-AB12 será aplicado ao criar.")).toBeInTheDocument();
  });
  it("PAID_PLAN_LINE é o texto aprovado", () => {
    expect(PAID_PLAN_LINE).toBe("O evento nasce grátis. Com plano pago, você paga com Pix ou cartão na tela seguinte.");
  });
});
