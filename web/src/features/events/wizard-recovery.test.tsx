import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
async function nameAndNext() { next(); fireEvent.change(screen.getByLabelText("Nome que os convidados vão ver"), { target: { value: "Festa preservada" } }); next(); }
/** Do passo 3 até o 8: festa, poses, revelar, filme, quem vê. */
async function finalStep() { await nameAndNext(); for (let i = 0; i < 5; i++) next(); await screen.findByRole("radio", { name: /^Grátis/ }); }
/** CTA do passo 8 → diálogo "Antes de criar" → aceites → Aceitar. */
async function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Criar câmera|Continuar ·/ }));
  const dialog = screen.queryByRole("dialog", { name: "Antes de criar" }); // só na primeira vez: os aceites ficam guardados
  if (!dialog) return;
  Array.from(dialog.querySelectorAll<HTMLInputElement>("input[type=checkbox]")).forEach((c) => fireEvent.click(c));
  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
}
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.push.mockReset(); mocks.destination.mockReset(); mocks.openCheckout.mockReset(); mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e); });
describe("recuperação do assistente", () => {
  it.each(["pendente", "falhou"])("checkout %s retoma o mesmo destino sem outro evento ou pedido", async (navigation) => {
    const checkout = "https://checkout.test/order-1";
    mocks.destination.mockResolvedValue({ kind: "checkout", url: checkout });
    if (navigation === "falhou") mocks.openCheckout.mockImplementationOnce(() => { throw new Error("navigation failed"); });
    render(<CreateWizard />);
    await finalStep();
    fireEvent.click(screen.getByRole("radio", { name: /^Casamento/ }));
    await submit();
    await waitFor(() => expect(mocks.openCheckout).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Continuar para o pagamento" });
    expect(screen.queryByRole("button", { name: /Criar câmera|Continuar ·/ })).toBeNull();
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
    fireEvent.click(screen.getByRole("radio", { name: /^Casamento/ }));
    await submit();
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
  it("36 fotos são desejo: o plano que comporta vem marcado no passo 8 e o Grátis segue disponível", async () => {
    render(<CreateWizard />); await nameAndNext(); next();
    fireEvent.click(await screen.findByRole("button", { name: /^36/ }));
    expect(screen.getByRole("button", { name: /^36/ })).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 4; i++) next();
    expect(screen.getByRole("radio", { name: /^Casamento/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Continuar · R$ 189" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Grátis/ }));
    expect(screen.getByRole("radio", { name: /^Grátis/ })).toBeChecked();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("10 poses: o Grátis vem marcado no passo 8", async () => {
    render(<CreateWizard />); await finalStep();
    expect(screen.getByRole("radio", { name: /^Grátis/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Criar câmera" })).toBeInTheDocument();
  });
  it("passo 5: quatro opções; revelar antes do fim da festa é bloqueado", async () => {
    render(<CreateWizard />); await nameAndNext(); next(); next();
    for (const t of ["Quando a festa acabar", "No dia seguinte", "Um dia depois", "Escolher dia e hora"]) expect(screen.getByRole("button", { name: new RegExp(t) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escolher dia e hora/ }));
    fireEvent.change(screen.getByLabelText("Dia e hora da revelação"), { target: { value: "2027-01-15T10:00" } });
    next();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quando revelar?" })).toBeInTheDocument();
  });
});
