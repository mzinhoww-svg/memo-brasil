import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ config: vi.fn(), recover: vi.fn(), call: vi.fn(), quote: vi.fn(), refund: vi.fn(), card: vi.fn(), invoke: vi.fn() }));
vi.mock("./validapay-client", async (importOriginal) => ({ ...await importOriginal<typeof import("./validapay-client")>(), sandboxConfig: api.config, recoverSandbox: api.recover, sandboxCall: api.call, sandboxRefund: api.refund }));
vi.mock("./validapay-card", () => ({ prepareCard: api.card }));
vi.mock("./api", () => ({ formatBRL: (n: number) => `R$ ${n / 100}`, quote: api.quote }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ functions: { invoke: api.invoke }, auth: { getUser: async () => ({ data: { user: { email: "test@example.test" } } }) } }) }));
import { ValidaPayCheckout } from "./ValidaPayCheckout";
beforeEach(() => {
  vi.clearAllMocks(); api.config.mockResolvedValue({ enabled: true, environment: "sandbox", publicId: null, requires3DS: true }); api.recover.mockResolvedValue(null);
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
    api.call.mockImplementation((body) => body.action === "reserve" ? new Promise((resolve) => { complete = resolve; }) : Promise.resolve({ orderId: "order", environment: "sandbox", status: "pendente", planCode: "festa", amountCents: 2900, emv: "000201-test" }));
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    const submit = await screen.findByRole("button", { name: "Gerar Pix" });
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Pessoa Teste" } });
    fireEvent.change(screen.getByLabelText("CPF ou CNPJ"), { target: { value: "12345678901" } });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(api.call).toHaveBeenCalledTimes(1));
    const sent = api.call.mock.calls[0][0];
    expect(sent).toMatchObject({ action: "reserve", method: "pix" });
    expect(sent).not.toHaveProperty("amountCents");
    complete({ orderId: "order", environment: "sandbox", status: "criado", planCode: "festa", amountCents: 2900 });
    expect(await screen.findByDisplayValue("000201-test")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mercado Pago/ })).not.toBeInTheDocument();
    expect(api.call.mock.calls[1][0]).toMatchObject({ action: "submit", customer: { name: "Pessoa Teste", documentNumber: "12345678901" } });
  });
  it("restores paid orders from the backend without creating a charge", async () => {
    api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "pago", amountCents: 2900, planCode: "festa" });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
    expect(api.call).not.toHaveBeenCalled();
  });
  it("allows resuming an uncertain creation using the existing server order", async () => {
    api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "criado", amountCents: 2900, planCode: "festa", paymentMethod: "pix" });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByRole("button", { name: "Gerar Pix" })).toBeInTheDocument();
  });
  it("offers a fresh intention after server-confirmed expiry", async () => {
    api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "expirado", amountCents: 2900, planCode: "festa" });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    expect(await screen.findByRole("button", { name: "Tentar novo pagamento" })).toBeInTheDocument();
  });
  it("requests an explicit sandbox refund only after a second confirmation", async () => {
    api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "pago", amountCents: 2900, planCode: "festa" });
    api.refund.mockResolvedValue({ confirmed: true, refundedCents: 2900 });
    render(<ValidaPayCheckout eventId="event" planCode="festa" />);
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar estorno de teste" }));
    expect(api.refund).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar estorno integral" }));
    expect(await screen.findByText("Pagamento estornado")).toBeInTheDocument();
    expect(api.refund).toHaveBeenCalledTimes(1);
  });
});

it("hides test refund for production paid orders", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "production", publicId: "public", requires3DS: true });
  api.recover.mockResolvedValue({ orderId: "order", environment: "production", status: "pago", amountCents: 2900, planCode: "festa", canAbandon: false });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Solicitar estorno de teste" })).not.toBeInTheDocument();
});
it("abandons only server-approved untouched orders and requotes before changing method", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "production", publicId: "public", requires3DS: true });
  api.recover.mockResolvedValue({ orderId: "order", environment: "production", status: "criado", amountCents: 2900, planCode: "festa", paymentMethod: "pix", canAbandon: true });
  api.call.mockResolvedValue({ abandoned: true });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  fireEvent.click(await screen.findByRole("button", { name: "Trocar forma de pagamento" }));
  await waitFor(() => expect(api.quote).toHaveBeenCalledWith("event", "festa"));
  expect(api.call).toHaveBeenCalledWith({ action: "abandon", orderId: "order" });
  expect(screen.getByLabelText("Cartão")).toBeEnabled();
});
it("does not offer abandonment for an uncertain server order", async () => {
  api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "criado", amountCents: 2900, planCode: "festa", paymentMethod: "pix", canAbandon: false });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await screen.findByRole("button", { name: "Gerar Pix" });
  expect(screen.queryByRole("button", { name: "Trocar forma de pagamento" })).not.toBeInTheDocument();
});

async function fillCard() {
  fireEvent.click(await screen.findByLabelText("Cartão"));
  const fields = { "Nome completo": "Pessoa Teste", "CPF ou CNPJ": "12345678901", "Nome do titular": "Pessoa Teste", "Número do cartão": "4111111111111111", "Validade (MM/AAAA)": "12/2035", "Código de segurança": "123", "Telefone": "11999999999", "CEP": "01310100", "Rua": "Rua Teste", "Número do endereço": "1", "Bairro": "Centro", "Cidade": "São Paulo", "Estado (UF)": "SP" };
  for (const [label, value] of Object.entries(fields)) fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("uses trusted production config and sends only tokens to the financial backend", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "production", publicId: "production-public", requires3DS: true });
  api.card.mockResolvedValue({ cardToken: "ctk_test", deviceId: "device", authentication: { authenticationId: "auth", cardId: "card" } });
  api.call.mockImplementation(async (body) => ({ orderId: "order", environment: "production", status: body.action === "reserve" ? "criado" : "pago", amountCents: 2900, planCode: "festa", canAbandon: body.action === "reserve" }));
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await fillCard(); fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
  await screen.findByText("Pagamento confirmado");
  expect(api.card.mock.calls[0][0]).toEqual({ publicId: "production-public", environment: "production" });
  const sent = api.call.mock.calls.find(([body]) => body.action === "submit")![0];
  expect(sent).toMatchObject({ cardToken: "ctk_test", authentication: { authenticationId: "auth", cardId: "card" } });
  expect(JSON.stringify(sent)).not.toContain("4111111111111111");
  expect(sent).not.toHaveProperty("cvv");
});
it("permits a fresh method after pre-submit 3DS failure only with server approval", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "production", publicId: "public", requires3DS: true });
  api.card.mockRejectedValue(new Error("3DS unavailable"));
  api.call.mockImplementation(async (body) => body.action === "abandon" ? { abandoned: true } : { orderId: "order", environment: "production", status: "criado", amountCents: 2900, planCode: "festa", canAbandon: true });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await fillCard(); fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
  await screen.findByRole("alert");
  expect(api.call.mock.calls.some(([body]) => body.action === "submit")).toBe(false);
  expect(screen.getByLabelText("Número do cartão")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Trocar forma de pagamento" }));
  await waitFor(() => expect(screen.getByLabelText("Pix")).toBeEnabled());
  expect(api.quote).toHaveBeenCalledTimes(2);
});
it("preserves the order after uncertain submission and refuses stale abandonment approval", async () => {
  api.call.mockImplementation(async (body) => {
    if (body.action === "reserve") return { orderId: "order", environment: "sandbox", status: "criado", amountCents: 2900, planCode: "festa", canAbandon: true };
    throw new Error("response lost");
  });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await screen.findByRole("button", { name: "Gerar Pix" });
  fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Pessoa Teste" } });
  fireEvent.change(screen.getByLabelText("CPF ou CNPJ"), { target: { value: "12345678901" } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
  await screen.findByRole("alert");
  expect(api.call).toHaveBeenCalledWith({ action: "status", orderId: "order" });
  expect(screen.queryByRole("button", { name: "Trocar forma de pagamento" })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("pagamento anterior");
});
it("rejects an invalid backend environment", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "invalid", publicId: "public", requires3DS: true });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await screen.findByText("Checkout indisponível");
  expect(api.recover).not.toHaveBeenCalled();
});

it("never confirms a sandbox receipt under trusted production config", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "production", publicId: "public", requires3DS: true });
  api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "pago", amountCents: 2900, planCode: "festa", canAbandon: false });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Pagamento confirmado")).not.toBeInTheDocument();
  expect(api.call).not.toHaveBeenCalled();
});
it("rejects a mismatched reservation before SDK invocation or financial submission", async () => {
  api.config.mockResolvedValue({ enabled: true, environment: "production", publicId: "public", requires3DS: true });
  api.call.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "criado", amountCents: 2900, planCode: "festa", canAbandon: true });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await fillCard(); fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
  await screen.findByRole("alert");
  expect(api.card).not.toHaveBeenCalled();
  expect(api.call.mock.calls.some(([body]) => body.action === "submit")).toBe(false);
});

it.each([undefined, "production"])("rejects recovered receipt environment %s under sandbox", async (environment) => {
  api.recover.mockResolvedValue({ orderId: "order", environment, status: "pago", amountCents: 2900, planCode: "festa" });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("outro ambiente");
  expect(screen.queryByText("Pagamento confirmado")).not.toBeInTheDocument();
});
it("rejects a mismatched financial response without displaying paid state", async () => {
  api.call.mockImplementation(async (body) => ({ orderId: "order", environment: body.action === "reserve" ? "sandbox" : "production", status: body.action === "reserve" ? "criado" : "pago", amountCents: 2900, planCode: "festa", canAbandon: true }));
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  await screen.findByRole("button", { name: "Gerar Pix" });
  fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Pessoa Teste" } });
  fireEvent.change(screen.getByLabelText("CPF ou CNPJ"), { target: { value: "12345678901" } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar Pix" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("outro ambiente");
  expect(screen.queryByText("Pagamento confirmado")).not.toBeInTheDocument();
});
it("rejects a status receipt from another environment", async () => {
  api.recover.mockResolvedValue({ orderId: "order", environment: "sandbox", status: "pendente", amountCents: 2900, planCode: "festa", canAbandon: false });
  api.call.mockResolvedValue({ orderId: "order", environment: "production", status: "pago", amountCents: 2900, planCode: "festa", canAbandon: false });
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  fireEvent.click(await screen.findByRole("button", { name: "Consultar pagamento" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("outro ambiente");
  expect(screen.queryByText("Pagamento confirmado")).not.toBeInTheDocument();
});
it("preserves the known backend environment conflict as a safe explicit message", async () => {
  const { ValidaPayEnvironmentConflictError } = await import("./validapay-client");
  api.recover.mockRejectedValue(new ValidaPayEnvironmentConflictError());
  render(<ValidaPayCheckout eventId="event" planCode="festa" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("outro ambiente");
  expect(screen.queryByRole("button", { name: "Gerar Pix" })).not.toBeInTheDocument();
});
it("parses only the allowlisted backend conflict error", async () => {
  const realClient = await vi.importActual<typeof import("./validapay-client")>("./validapay-client");
  api.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: "pedido_outro_ambiente" }), { status: 409 }) } });
  await expect(realClient.sandboxCall({ action: "recover" })).rejects.toBeInstanceOf(realClient.ValidaPayEnvironmentConflictError);
  api.invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: "sensitive backend detail" }), { status: 500 }) } });
  await expect(realClient.sandboxCall({ action: "recover" })).rejects.toThrow("Não foi possível confirmar");
});
