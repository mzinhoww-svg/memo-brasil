import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ config: vi.fn(), recover: vi.fn(), call: vi.fn(), quote: vi.fn(), refund: vi.fn() }));
vi.mock("./validapay-client", () => ({ sandboxConfig: api.config, recoverSandbox: api.recover, sandboxCall: api.call, sandboxRefund: api.refund }));
vi.mock("./api", () => ({ formatBRL: (n: number) => `R$ ${n / 100}`, quote: api.quote }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ auth: { getUser: async () => ({ data: { user: { email: "test@example.test" } } }) } }) }));
import { ValidaPayCheckout } from "./ValidaPayCheckout";
beforeEach(() => {
  vi.clearAllMocks(); api.config.mockResolvedValue({ enabled: true, environment: "sandbox", publicId: null }); api.recover.mockResolvedValue(null);
  api.quote.mockResolvedValue({ payable: true, amountCents: 2900 });
});
describe("sandbox native checkout", () => {
  it("fails closed when the backend feature is disabled", async () => {
    api.config.mockResolvedValue({ enabled: false, environment: "sandbox", publicId: null });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByText(/Checkout indisponível/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar Pix/ })).not.toBeInTheDocument();
  });
  it("does not offer card without the sandbox publicId", async () => {
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByLabelText("Cartão")).toBeDisabled();
  });
  it("prevents duplicate Pix submission and displays copy-and-paste data in the app", async () => {
    let complete: (x: unknown) => void = () => undefined;
    api.call.mockImplementation((body) => body.action === "reserve" ? new Promise((resolve) => { complete = resolve; }) : Promise.resolve({ orderId: "order", status: "pendente", planCode: "festa", amountCents: 2900, emv: "000201-test" }));
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    const submit = await screen.findByRole("button", { name: "Gerar Pix" });
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Pessoa Teste" } });
    fireEvent.change(screen.getByLabelText("CPF ou CNPJ"), { target: { value: "12345678901" } });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(api.call).toHaveBeenCalledTimes(1));
    const sent = api.call.mock.calls[0][0];
    expect(sent).toMatchObject({ action: "reserve", method: "pix" });
    expect(sent).not.toHaveProperty("amountCents");
    complete({ orderId: "order", status: "criado", planCode: "festa", amountCents: 2900 });
    expect(await screen.findByDisplayValue("000201-test")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mercado Pago/ })).not.toBeInTheDocument();
    expect(api.call.mock.calls[1][0]).toMatchObject({ action: "submit", customer: { name: "Pessoa Teste", documentNumber: "12345678901" } });
  });
  it("restores paid orders from the backend without creating a charge", async () => {
    api.recover.mockResolvedValue({ orderId: "order", status: "pago", amountCents: 2900, planCode: "festa" });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(api.call).not.toHaveBeenCalled();
  });
  it("allows resuming an uncertain creation using the existing server order", async () => {
    api.recover.mockResolvedValue({ orderId: "order", status: "criado", amountCents: 2900, planCode: "festa", paymentMethod: "pix" });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByRole("button", { name: "Gerar Pix" })).toBeInTheDocument();
  });
  it("offers a fresh intention after server-confirmed expiry", async () => {
    api.recover.mockResolvedValue({ orderId: "order", status: "expirado", amountCents: 2900, planCode: "festa" });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByRole("button", { name: "Tentar novo pagamento" })).toBeInTheDocument();
  });
  it("requests an explicit sandbox refund only after a second confirmation", async () => {
    api.recover.mockResolvedValue({ orderId: "order", status: "pago", amountCents: 2900, planCode: "festa" });
    api.refund.mockResolvedValue({ confirmed: true, refundedCents: 2900 });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar estorno de teste" }));
    expect(api.refund).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estorno integral" }));
    expect(await screen.findByText("Pagamento estornado")).toBeInTheDocument();
    expect(api.refund).toHaveBeenCalledTimes(1);
  });
});
