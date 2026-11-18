import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), lookup: vi.fn(), save: vi.fn(), push: vi.fn(), destination: vi.fn(), openCheckout: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/criar" }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: { events: { getByCode: mocks.lookup, save: mocks.save } }, user: { id: "u", name: "Ana" }, signIn: mocks.signIn, now: () => 1800000000000, ready: true, backend: "local", canCreate: true }) }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), listPublicPlans: async () => [{ code: "gratis", name: "Grátis", isFree: true, maxShots: 10, maxGuests: 10, priceCents: 0, features: [] }, { code: "casamento", name: "Casamento", isFree: false, maxShots: 36, maxGuests: 250, priceCents: 18900, features: [] }], getPublicSettings: async () => ({}) }));
vi.mock("./after-create", () => ({ afterCreateDestination: mocks.destination }));
vi.mock("@/features/billing/checkout-nav", () => ({ goToCheckout: mocks.openCheckout }));
import { CreateWizard } from "./wizard";
const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
/** Passo 1 (embalagem) → 2 (nome) → preenche → 3 (quando é a festa). */
async function nameAndNext() { next(); fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Festa preservada" } }); next(); }
/** Do passo 3 até o 7: festa, revelar, filme, quem vê. Sem escolha de plano: o evento nasce no Grátis. */
async function finalStep() { await nameAndNext(); for (let i = 0; i < 4; i++) next(); await screen.findByRole("button", { name: "Criar câmera" }); }
/** CTA do último passo: tocar em continuar vale como aceite (aviso junto ao botão); não há diálogo. */
async function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Criar câmera|Continuar ·/ }));
  expect(screen.queryByRole("dialog", { name: "Antes de criar" })).toBeNull();
}
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.push.mockReset(); mocks.destination.mockReset(); mocks.openCheckout.mockReset(); mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e); });
describe("recuperação do assistente", () => {
  it.each(["pendente", "falhou"])("navegação %s depois de salvar só retoma o mesmo evento", async (navigation) => {
    if (navigation === "falhou") mocks.push.mockImplementationOnce(() => { throw new Error("navigation failed"); });
    render(<CreateWizard />);
    await finalStep();
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    const eventId = mocks.save.mock.calls[0][0].id;
    // A chamada a push já retornou; o teste mantém a tela montada como em uma navegação lenta.
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /Criar câmera|Continuar ·/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Evento criado." })).toBeInTheDocument();
    if (navigation === "falhou") expect(screen.getByRole("alert")).toHaveTextContent(/evento.*criado/);
    fireEvent.click(screen.getByRole("button", { name: "Continuar para o convite" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(2));
    expect(mocks.push.mock.calls.map(([href]) => href)).toEqual([`/criar/pronto/${eventId}`, `/criar/pronto/${eventId}`]);
    expect(mocks.save).toHaveBeenCalledOnce();
  });
  it("fim antes de 30 minutos a partir de agora mantém o passo e explica o campo", async () => {
    render(<CreateWizard />); await nameAndNext();
    fireEvent.change(screen.getByLabelText("Termina"), { target: { value: "00:00" } });
    fireEvent.change(screen.getByLabelText("Começa"), { target: { value: "23:50" } });
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "2000-01-01" } });
    next();
    expect(screen.getByRole("alert")).toHaveTextContent(/pelo menos 30 minutos/);
    expect(screen.getByRole("heading", { name: "Quando é a festa?" })).toBeInTheDocument();
  });
  it.each(["perfil", "código"])("falha em %s destrava, preserva campos e permite tentar novamente", async (stage) => {
    render(<CreateWizard />); await finalStep();
    if (stage === "perfil") mocks.signIn.mockRejectedValueOnce(new Error("offline")); else mocks.lookup.mockRejectedValueOnce(new Error("offline"));
    await submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/tente/));
    expect(screen.getByRole("button", { name: /Criar câmera|Continuar ·/ })).toBeEnabled();
    await submit();
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].title).toBe("Festa preservada");
  });
  it("passo 4: quatro opções; revelar antes do fim da festa é bloqueado", async () => {
    render(<CreateWizard />); await nameAndNext(); next(); // quando é a festa → quando revelar
    for (const t of ["Quando a festa acabar", "No dia seguinte", "Um dia depois", "Escolher dia e hora"]) expect(screen.getByRole("button", { name: new RegExp(t) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escolher dia e hora/ }));
    fireEvent.change(screen.getByLabelText("Dia e hora da revelação"), { target: { value: "2027-01-15T10:00" } });
    next();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quando revelar?" })).toBeInTheDocument();
  });
});
