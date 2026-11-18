import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redeem: vi.fn(), signIn: vi.fn(), lookup: vi.fn(), save: vi.fn(), push: vi.fn(), destination: vi.fn(), openCheckout: vi.fn() }));
const P = (code: string, name: string, g: number | null, s: number | null, cents: number, extra = {}) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: cents === 0, features: [], ...extra });
const CATALOG = [P("gratis", "Grátis", 10, 10, 0), P("ate150", "Até 150 convidados", 150, 36, 14700, { highlighted: true }), P("ate300", "Até 300 convidados", 300, 36, 29700)];
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/criar" }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: { events: { getByCode: mocks.lookup, save: mocks.save } }, user: { id: "u", name: "Ana" }, signIn: mocks.signIn, now: () => 1800000000000, ready: true, backend: "local", canCreate: true }) }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), listPublicPlans: async () => CATALOG, listPosePacks: async () => [], getPublicSettings: async () => ({}), peekCode: async () => null, redeemCode: mocks.redeem }));
vi.mock("./after-create", () => ({ afterCreateDestination: mocks.destination }));
vi.mock("@/features/billing/checkout-nav", () => ({ goToCheckout: mocks.openCheckout }));
import { CreateWizard } from "./wizard";

const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
function toName() { render(<CreateWizard />); next(); fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } }); }

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e);
});

describe("assistente sem poses nem plano: o evento nasce no Grátis", () => {
  it("depois da revelação vem o filme (sem o passo Poses)", () => {
    toName();
    for (let i = 0; i < 3; i++) next(); // nome → festa → revelar → filme
    expect(screen.getByRole("heading", { name: "Qual filme?" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Poses por pessoa" })).toBeNull();
  });

  it("publicar: sem cartões de plano nem preço; cria no Grátis (10 poses) e vai ao convite, sem checkout", async () => {
    toName();
    for (let i = 0; i < 5; i++) next();
    const cta = await screen.findByRole("button", { name: "Criar câmera" });
    expect(screen.queryByRole("radio", { name: /Até 150 convidados/ })).toBeNull();
    expect(screen.queryByText(/R\$/)).toBeNull();
    fireEvent.click(cta);
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ shotsPerPerson: 10 });
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith(expect.stringMatching(/^\/criar\/pronto\//)));
    expect(mocks.destination).not.toHaveBeenCalled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
  });

  it("código de cortesia guardado continua sendo aplicado depois de criar", async () => {
    localStorage.setItem("mm-codigo-pendente", JSON.stringify({ c: "MMT-7KQ4-AB12", t: Date.now() }));
    mocks.redeem.mockResolvedValue({ applied: true, reason: "ok", planCode: "ate150", code: "MMT-7KQ4-AB12" });
    toName();
    for (let i = 0; i < 5; i++) next();
    expect(await screen.findByTestId("aviso-codigo")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Criar câmera" }));
    await vi.waitFor(() => expect(mocks.redeem).toHaveBeenCalledOnce());
    expect(mocks.redeem.mock.calls[0][1]).toBe("MMT-7KQ4-AB12");
  });
  it("veio da home com ?plano=ate150: cria no Grátis e segue para escolher a faixa no painel", async () => {
    window.history.replaceState(null, "", "/criar?plano=ate150");
    try {
      toName();
      for (let i = 0; i < 5; i++) next();
      fireEvent.click(await screen.findByRole("button", { name: "Criar câmera" }));
      await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith(expect.stringMatching(/^\/painel\/[^/]+\/plano\?plano=ate150$/)));
    } finally { window.history.replaceState(null, "", "/"); }
  });
  it("?plano= desconhecido ou grátis é ignorado: segue para o convite", async () => {
    window.history.replaceState(null, "", "/criar?plano=casamento");
    try {
      toName();
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); // catálogo carregado (como depois de 5 passos)
      for (let i = 0; i < 5; i++) next();
      fireEvent.click(await screen.findByRole("button", { name: "Criar câmera" }));
      await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith(expect.stringMatching(/^\/criar\/pronto\//)));
    } finally { window.history.replaceState(null, "", "/"); }
  });
});
