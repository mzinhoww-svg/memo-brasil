import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("./api", () => ({ formatBRL: () => "R$ 29,00", orderStatus: vi.fn() }));
import { CheckoutPending } from "./CheckoutPending";
import type { OrderView } from "./types";
const base: OrderView = { orderId: "order", status: "pago", planCode: "festa", amountCents: 2900, provider: "validapay" };
function view(order: OrderView) { return render(<CheckoutPending order={order} plans={[]} eventId="event" onOrder={vi.fn()} onNewCheckout={vi.fn()} onChoosePlan={vi.fn()} />); }
describe("truthful payment receipt", () => {
  it.each([false, undefined])("does not assert activation when entitlementActive is %s", (entitlementActive) => {
    view({ ...base, entitlementActive });
    expect(screen.queryByText(/ativo\./)).not.toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent("Pagamento recebido");
  });
  it("explains refund review without claiming a completed refund or activation", () => {
    view({ ...base, needsRefund: true, entitlementActive: false });
    expect(screen.getByText(/devolução.*análise/)).toBeInTheDocument();
    expect(screen.queryByText(/ativo\./)).not.toBeInTheDocument();
  });
  it.each(["validapay", "mercadopago"] as const)("uses the actual %s provider instructions", (provider) => {
    view({ ...base, status: "pendente", provider });
    if (provider === "validapay") {
      expect(screen.queryByText(/No Mercado Pago/)).not.toBeInTheDocument();
      expect(screen.getByText(/Pagamento processado pela ValidaPay/)).toBeInTheDocument();
    } else expect(screen.getByText(/No Mercado Pago/)).toBeInTheDocument();
  });
});
