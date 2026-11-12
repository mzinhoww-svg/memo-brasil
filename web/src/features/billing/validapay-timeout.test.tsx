import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ config: vi.fn(), recover: vi.fn(), quote: vi.fn(), push: vi.fn() }));
vi.mock("./validapay-client", async (importOriginal) => ({ ...await importOriginal<typeof import("./validapay-client")>(), sandboxConfig: api.config, recoverSandbox: api.recover }));
vi.mock("./api", () => ({ formatBRL: (n: number) => `R$ ${n / 100}`, quote: api.quote, listPosePacks: async () => [], listPublicPlans: async () => [] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ functions: { invoke: vi.fn() }, auth: { getUser: async () => ({ data: { user: { email: "t@example.test" } } }) } }) }));
import { ValidaPayCheckout } from "./ValidaPayCheckout";
import { ValidaPayTimeoutError, withTimeout } from "./validapay-client";

const never = () => new Promise<never>(() => undefined);
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  api.push.mockReset();
  api.config.mockReset(); api.recover.mockReset(); api.quote.mockReset();
  api.recover.mockResolvedValue(null);
  api.quote.mockResolvedValue({ payable: true, amountCents: 2900 });
});
afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("resolve com o valor se vier a tempo e rejeita com ValidaPayTimeoutError depois do prazo", async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
    const slow = withTimeout(never(), 100);
    const caught = slow.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(101);
    expect(await caught).toBeInstanceOf(ValidaPayTimeoutError);
  });
  it("repassa o erro original da chamada", async () => {
    await expect(withTimeout(Promise.reject(new Error("x")), 100)).rejects.toThrow("x");
  });
});

describe("carregamento do pagamento que trava", () => {
  it("passa de ~8 s: mostra 'Está demorando mais que o normal' no mesmo layout, com Tentar de novo e Voltar aos planos", async () => {
    api.config.mockImplementation(never);
    render(<ValidaPayCheckout eventId="ev" planCode="festa" />);
    await tick(7_000);
    expect(screen.queryByText("Está demorando mais que o normal")).toBeNull();
    await tick(1_500);
    expect(screen.getByText("Está demorando mais que o normal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos planos" }));
    expect(api.push).toHaveBeenCalledWith("/painel/ev/plano");
  });

  it("'Tentar de novo' recarrega: a chamada é refeita e o pagamento abre", async () => {
    api.config.mockImplementationOnce(never).mockResolvedValue({ enabled: true, environment: "sandbox", publicId: null, requires3DS: true });
    render(<ValidaPayCheckout eventId="ev" planCode="festa" />);
    await tick(8_500);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await tick(50);
    expect(api.config).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("radio", { name: "Pix" })).toBeInTheDocument();
  });

  it("chamada que passa de 12 s falha com a causa em texto claro e oferece Tentar novamente e Voltar aos planos", async () => {
    api.config.mockImplementation(never);
    render(<ValidaPayCheckout eventId="ev" planCode="festa" />);
    await tick(12_100);
    expect(screen.getByText("Checkout indisponível")).toBeInTheDocument();
    expect(screen.getByText(/A conexão com o pagamento demorou demais/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar aos planos" })).toBeInTheDocument();
  });

  it("a cotação travada também vence em 12 s", async () => {
    api.config.mockResolvedValue({ enabled: true, environment: "sandbox", publicId: null, requires3DS: true });
    api.quote.mockImplementation(never);
    render(<ValidaPayCheckout eventId="ev" planCode="festa" />);
    await tick(12_200);
    expect(screen.getByText(/demorou demais/)).toBeInTheDocument();
  });

  it("checkout desligado: a causa e as duas saídas (Tentar de novo e Voltar aos planos)", async () => {
    api.config.mockResolvedValue({ enabled: false, environment: "sandbox", publicId: null, requires3DS: true });
    render(<ValidaPayCheckout eventId="ev" planCode="festa" />);
    await tick(50);
    expect(screen.getByText("Esta forma de pagamento ainda não está disponível.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar aos planos" })).toBeInTheDocument();
  });
});
