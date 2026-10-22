import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanChoice, FREE_PLAN_OPTION, PAID_PLAN_LINE, hasPaidPlan } from "./PlanChoice";

describe("PlanChoice", () => {
  it("mostra só o Grátis (10 convidados / 10 fotos), marcado; a lista estática não tem plano pago", () => {
    const onSelect = vi.fn();
    render(<PlanChoice plans={[FREE_PLAN_OPTION]} selected="gratis" onSelect={onSelect} />);
    const r = screen.getByRole("radio", { name: /Até 10 · Grátis/ });
    expect(r).toBeChecked();
    expect(screen.getByText(/10 fotos por pessoa/)).toBeInTheDocument();
    expect(hasPaidPlan([FREE_PLAN_OPTION])).toBe(false);
    expect(screen.queryByText(PAID_PLAN_LINE)).toBeNull();
  });
  it("com plano pago na lista, devolve a escolha e reconhece o plano pago", () => {
    const onSelect = vi.fn();
    const plans = [FREE_PLAN_OPTION, { code: "festa", title: "Até 30 · R$ 29", detail: "Festa · 24 fotos por pessoa", priceBrl: 29 }];
    expect(hasPaidPlan(plans)).toBe(true);
    render(<PlanChoice plans={plans} selected="gratis" onSelect={onSelect} />);
    expect(PAID_PLAN_LINE).toBe("O evento nasce grátis. Com plano pago, você paga no Pix na tela seguinte.");
    fireEvent.click(screen.getByRole("radio", { name: /Até 30 · R\$ 29/ }));
    expect(onSelect).toHaveBeenCalledWith("festa");
  });
});
