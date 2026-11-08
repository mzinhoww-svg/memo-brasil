import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), lookup: vi.fn(), save: vi.fn(), push: vi.fn(), destination: vi.fn(), openCheckout: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/criar" }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: { events: { getByCode: mocks.lookup, save: mocks.save } }, user: { id: "u", name: "Ana" }, signIn: mocks.signIn, now: () => 1800000000000, ready: true, backend: "local", canCreate: true }) }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), listPublicPlans: async () => [{ code: "gratis", name: "Grátis", isFree: true, maxShots: 10, maxGuests: 10, priceCents: 0, features: [] }, { code: "casamento", name: "Casamento", isFree: false, maxShots: 36, maxGuests: 250, priceCents: 18900, features: [] }], getPublicSettings: async () => ({}) }));
vi.mock("./after-create", () => ({ afterCreateDestination: mocks.destination }));
vi.mock("@/features/billing/checkout-nav", () => ({ goToCheckout: mocks.openCheckout }));
import { CreateWizard } from "./wizard";
async function nameAndNext() { fireEvent.change(screen.getByLabelText("Nome que os convidados vão ver"), { target: { value: "Festa preservada" } }); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); }
async function finalStep() { await nameAndNext(); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); await screen.findByRole("radio", { name: /Até 10/ }); screen.getAllByRole("checkbox").forEach((c) => fireEvent.click(c)); }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.push.mockReset(); mocks.destination.mockReset(); mocks.openCheckout.mockReset(); mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e); });
describe("recuperação do assistente", () => {
  it.each(["pendente", "falhou"])("checkout %s retoma o mesmo destino sem outro evento ou pedido", async (navigation) => {
    const checkout = "https://checkout.test/order-1";
    mocks.destination.mockResolvedValue({ kind: "checkout", url: checkout });
    if (navigation === "falhou") mocks.openCheckout.mockImplementationOnce(() => { throw new Error("navigation failed"); });
    render(<CreateWizard />);
    await finalStep();
    fireEvent.click(screen.getByRole("radio", { name: /Até 250/ }));
    const submit = screen.getByRole("button", { name: "Criar evento" });
    const form = submit.closest("form")!;
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.openCheckout).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Continuar para o pagamento" });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.queryByRole("button", { name: "Criar evento" })).toBeNull();
    if (navigation === "falhou") expect(screen.getByRole("alert")).toHaveTextContent(/evento.*criado/);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }));
    await waitFor(() => expect(mocks.openCheckout).toHaveBeenCalledTimes(2));
    expect(mocks.openCheckout.mock.calls.map(([url]) => url)).toEqual([checkout, checkout]);
    expect(mocks.destination).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("falha ao preparar o destino preserva o evento e oferece seu plano sem repetir checkout", async () => {
    mocks.destination.mockRejectedValueOnce(new Error("offline"));
    render(<CreateWizard />);
    await finalStep();
    fireEvent.click(screen.getByRole("radio", { name: /Até 250/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar evento" }));
    await screen.findByRole("alert");
    const eventId = mocks.save.mock.calls[0][0].id;
    fireEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }));
    expect(mocks.push).toHaveBeenCalledWith(`/painel/${eventId}/plano?plano=casamento`);
    expect(mocks.destination).toHaveBeenCalledExactlyOnceWith(eventId, "casamento");
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it.each(["pendente", "falhou"])("navegação %s depois de salvar só retoma o mesmo evento", async (navigation) => {
    if (navigation === "falhou") mocks.push.mockImplementationOnce(() => { throw new Error("navigation failed"); });
    render(<CreateWizard />);
    await finalStep();
    const submit = screen.getByRole("button", { name: "Criar evento" });
    const form = submit.closest("form")!;
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    const eventId = mocks.save.mock.calls[0][0].id;
    // A chamada a push já retornou; o teste mantém a tela montada como em uma navegação lenta.
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Criar evento" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Evento criado." })).toBeInTheDocument();
    if (navigation === "falhou") expect(screen.getByRole("alert")).toHaveTextContent(/evento.*criado/);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para o convite" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(2));
    expect(mocks.push.mock.calls.map(([href]) => href)).toEqual([`/criar/pronto/${eventId}`, `/criar/pronto/${eventId}`]);
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("Outra data vazia mantém o passo e explica o campo", async () => { render(<CreateWizard />); await nameAndNext(); fireEvent.click(screen.getByRole("button", { name: "Outra data" })); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); expect(screen.getByLabelText("Escolha o horário")).toBeInTheDocument(); expect(screen.getByRole("alert")).toHaveTextContent(/data e.*horário/); });
  it.each(["perfil", "código"])("falha em %s destrava, preserva campos e permite tentar novamente", async (stage) => { render(<CreateWizard />); await finalStep(); if (stage === "perfil") mocks.signIn.mockRejectedValueOnce(new Error("offline")); else mocks.lookup.mockRejectedValueOnce(new Error("offline")); fireEvent.click(screen.getByRole("button", { name: "Criar evento" })); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/tente/)); expect(screen.getByRole("button", { name: "Criar evento" })).toBeEnabled(); expect(screen.getAllByRole("checkbox").every((c) => (c as HTMLInputElement).checked)).toBe(true); fireEvent.click(screen.getByRole("button", { name: "Criar evento" })); await waitFor(() => expect(mocks.push).toHaveBeenCalled()); expect(mocks.save.mock.calls[0][0].title).toBe("Festa preservada"); });
  it("36 fotos são desejo, com recomendação explícita e Grátis preservado", async () => { render(<CreateWizard />); await nameAndNext(); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); fireEvent.click(await screen.findByRole("button", { name: /36/ })); expect(screen.getByTestId("contador-previa")).toHaveTextContent("FOTOS DESEJADAS"); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); expect(screen.getByRole("radio", { name: /Até 10/ })).toBeChecked(); expect(screen.getByRole("button", { name: /Escolher Casamento/ })).toBeInTheDocument(); expect(screen.getByText(/Limite ao criar: 10 fotos/)).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: /Escolher Casamento/ })); expect(screen.getByRole("radio", { name: /Até 250/ })).toBeChecked(); expect(mocks.save).not.toHaveBeenCalled(); });
});
