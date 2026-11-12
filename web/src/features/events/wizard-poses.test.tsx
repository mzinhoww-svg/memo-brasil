import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), lookup: vi.fn(), save: vi.fn(), push: vi.fn(), destination: vi.fn(), openCheckout: vi.fn() }));
const state = vi.hoisted(() => ({ plans: [] as unknown[], packs: [] as unknown[] }));
const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const CATALOG = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 50, 24, 5990), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const PACK = (base: string, name: string, g: number, cents: number, available = true) => ({ code: `${base}_36`, baseCode: base, name: `${name} + Mais poses`, maxGuests: g, maxShots: 36, baseMaxShots: 24, priceCents: cents, extraCents: 1990, available });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/criar" }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: { events: { getByCode: mocks.lookup, save: mocks.save } }, user: { id: "u", name: "Ana" }, signIn: mocks.signIn, now: () => 1800000000000, ready: true, backend: "local", canCreate: true }) }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), listPublicPlans: async () => state.plans, listPosePacks: async () => state.packs, getPublicSettings: async () => ({}) }));
vi.mock("./after-create", () => ({ afterCreateDestination: mocks.destination }));
vi.mock("@/features/billing/checkout-nav", () => ({ goToCheckout: mocks.openCheckout }));
import { CreateWizard } from "./wizard";

const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
/** Passo 1 → nome → 3 (quando é) → 4 (revelar) → 5 (poses). */
async function toPoses() { next(); fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Festa" } }); next(); next(); next(); await screen.findByRole("group", { name: "Poses por pessoa" }); }
const choice = (n: string) => screen.getByRole("button", { name: new RegExp(`^${n} ·`) });
async function toPlanStep() { for (let i = 0; i < 3; i++) next(); await screen.findByRole("radio", { name: /^Grátis/ }); }

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); state.plans = CATALOG; state.packs = [PACK("festa", "Festa", 50, 7980), PACK("celebracao", "Celebração", 100, 10890)];
  mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e);
});

describe("passo Poses: opções e custo do catálogo real", () => {
  it("opções 10, 24, 36 e Livre (o catálogo tem plano sem limite); sem a de 27", async () => {
    render(<CreateWizard />); await toPoses();
    const group = screen.getByRole("group", { name: "Poses por pessoa" });
    await waitFor(() => expect(within(group).getAllByRole("button")).toHaveLength(4));
    expect(within(group).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["10 · Grátis", "24 · a partir de R$ 59,90", "36 · a partir de R$ 189", "Livre · a partir de R$ 349"]);
    expect(screen.queryByRole("button", { name: /^27/ })).toBeNull();
    expect(screen.queryByText(/exige/)).toBeNull();
  });
  it("sem plano sem limite no catálogo, não há opção Livre", async () => {
    state.plans = CATALOG.slice(0, 4);
    render(<CreateWizard />); await toPoses();
    await waitFor(() => expect(choice("36")).toHaveTextContent("a partir de R$ 189"));
    expect(screen.queryByRole("button", { name: /^Livre/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /· / })).toHaveLength(3);
  });
  it("sem plano pago ativo, as opções acima do Grátis dizem 'indisponível' e não prometem troca de plano", async () => {
    state.plans = CATALOG.slice(0, 1);
    render(<CreateWizard />); await toPoses();
    await waitFor(() => expect(choice("24")).toHaveTextContent("indisponível"));
    fireEvent.click(choice("24"));
    expect(screen.queryByTestId("aviso-plano-poses")).toBeNull();
  });
  it("aviso 'Isso muda seu plano para {Plano}' aparece acima do Grátis e some no Grátis", async () => {
    render(<CreateWizard />); await toPoses();
    await waitFor(() => expect(choice("24")).toHaveTextContent("a partir de R$ 59,90"));
    expect(screen.queryByTestId("aviso-plano-poses")).toBeNull();
    fireEvent.click(choice("24"));
    expect(screen.getByTestId("aviso-plano-poses")).toHaveTextContent("Isso muda seu plano para Festa.");
    fireEvent.click(choice("36"));
    expect(screen.getByTestId("aviso-plano-poses")).toHaveTextContent("Isso muda seu plano para Casamento.");
    fireEvent.click(choice("Livre"));
    expect(screen.getByTestId("aviso-plano-poses")).toHaveTextContent("Isso muda seu plano para Grande.");
    expect(document.querySelector(".rv-counter b")).toHaveTextContent("Livre");
    fireEvent.click(choice("10"));
    expect(screen.queryByTestId("aviso-plano-poses")).toBeNull();
  });
  it("a pré-seleção do plano no passo 8 continua igual: 24 → Festa", async () => {
    render(<CreateWizard />); await toPoses();
    await waitFor(() => expect(choice("24")).toHaveTextContent("a partir de R$ 59,90"));
    fireEvent.click(choice("24")); await toPlanStep();
    expect(screen.getByRole("radio", { name: /^Festa/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Continuar · R$ 59,90" })).toBeInTheDocument();
  });
});

describe("passo 8: interruptor Mais poses", () => {
  async function onFesta() { await toPoses(); await waitFor(() => expect(choice("24")).toHaveTextContent("a partir de")); fireEvent.click(choice("24")); await toPlanStep(); }
  async function accept() {
    const dialog = await screen.findByRole("dialog", { name: "Antes de criar" });
    Array.from(dialog.querySelectorAll<HTMLInputElement>("input[type=checkbox]")).forEach((c) => fireEvent.click(c));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
  }
  it("aparece nos cartões Festa e Celebração com o preço do catálogo; não no Grátis nem no Casamento", async () => {
    render(<CreateWizard />); await onFesta();
    const sw = await screen.findByRole("switch", { name: "Mais poses +R$ 19,90" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("mais-poses-opcao")).toHaveTextContent("+12 poses por pessoa (24 → 36)");
    fireEvent.click(screen.getByRole("radio", { name: /^Celebração/ }));
    expect(screen.getByRole("switch", { name: "Mais poses +R$ 19,90" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("radio", { name: /^Casamento/ }));
    expect(screen.queryByRole("switch", { name: /Mais poses/ })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /^Grátis/ }));
    expect(screen.queryByRole("switch", { name: /Mais poses/ })).toBeNull();
  });
  it("ligar soma ao total no botão e no resumo; desligar volta; trocar de plano desliga", async () => {
    render(<CreateWizard />); await onFesta();
    expect(screen.getByRole("button", { name: "Continuar · R$ 59,90" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("switch", { name: "Mais poses +R$ 19,90" }));
    expect(screen.getByRole("button", { name: "Continuar · R$ 79,80" })).toBeInTheDocument();
    expect(screen.getByText("36 por pessoa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Mais poses +R$ 19,90" }));
    expect(screen.getByRole("button", { name: "Continuar · R$ 59,90" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Mais poses +R$ 19,90" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Celebração/ }));
    expect(screen.getByRole("switch", { name: "Mais poses +R$ 19,90" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Continuar · R$ 89" })).toBeInTheDocument();
  });
  it("pacote desligado no servidor (available=false) ou sem pacotes: nada de interruptor", async () => {
    state.packs = [PACK("festa", "Festa", 50, 7980, false)];
    render(<CreateWizard />); await onFesta();
    expect(screen.queryByRole("switch", { name: /Mais poses/ })).toBeNull();
  });
  it("com o pacote ligado, o pedido é do plano-variante (o servidor cobra e decide as poses)", async () => {
    mocks.destination.mockResolvedValue({ kind: "plan", href: "/painel/x/checkout-validapay?plano=festa_36" });
    render(<CreateWizard />); await onFesta();
    fireEvent.click(await screen.findByRole("switch", { name: "Mais poses +R$ 19,90" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar · R$ 79,80" }));
    await accept();
    await waitFor(() => expect(mocks.destination).toHaveBeenCalledOnce());
    expect(mocks.destination.mock.calls[0][1]).toBe("festa_36");
    // o evento nasce com os limites do Grátis; o cliente nunca envia as 36 poses
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ shotsPerPerson: 10, capacity: 10 });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/painel/x/checkout-validapay?plano=festa_36"));
  });
  it("sem ligar o interruptor, o pedido continua sendo do plano base", async () => {
    mocks.destination.mockResolvedValue({ kind: "plan", href: "/painel/x/checkout-validapay?plano=festa" });
    render(<CreateWizard />); await onFesta();
    fireEvent.click(screen.getByRole("button", { name: "Continuar · R$ 59,90" }));
    await accept();
    await waitFor(() => expect(mocks.destination).toHaveBeenCalledOnce());
    expect(mocks.destination.mock.calls[0][1]).toBe("festa");
  });
});
