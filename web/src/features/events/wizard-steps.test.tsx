import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), lookup: vi.fn(), save: vi.fn(), push: vi.fn(), peek: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/criar" }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: { events: { getByCode: mocks.lookup, save: mocks.save } }, user: { id: "u", name: "Ana" }, signIn: mocks.signIn, now: () => 1800000000000, ready: true, backend: "local", canCreate: true }) }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), listPublicPlans: async () => [{ code: "gratis", name: "Grátis", isFree: true, maxShots: 10, maxGuests: 10, priceCents: 0, features: [] }], getPublicSettings: async () => ({}), peekCode: async (c: string) => (mocks.peek(c) ?? null) }));
import { CreateWizard } from "./wizard";
const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e); });

describe("passos 1, 2, 6 e 7 do assistente (telas 07, 08, 12, 13)", async () => {
  it("1 · embalagem: amostras do desenho; escolher troca a câmera, o nome e o texto", async () => {
    render(<CreateWizard />);
    expect(screen.getByRole("heading", { name: "Escolha a embalagem" })).toBeInTheDocument();
    expect(screen.getByText("1/8")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Festa", "Casamento", "Aniversário", "Noite"]);
    fireEvent.click(screen.getByRole("radio", { name: "Casamento" }));
    expect(screen.getByRole("radio", { name: "Casamento" })).toBeChecked();
    expect(screen.getByText("Marfim com faixa dourada. O nome do casal sai impresso.")).toBeInTheDocument();
    // a imagem gira (flipWrap) e só então assume o novo arquivo
    await waitFor(() => expect(screen.getByAltText("Câmera com embalagem Casamento")).toHaveAttribute("src", "/revela/ref/cam-casamento.webp"));
  });
  it("2 · nome: prévia da embalagem, chips preenchem o campo real, sem teclado desenhado e nome vazio não avança", () => {
    render(<CreateWizard />);
    fireEvent.click(screen.getByRole("radio", { name: "Casamento" }));
    next();
    expect(screen.getByRole("heading", { name: "Nome do evento" })).toBeInTheDocument();
    expect(screen.getByAltText("Embalagem com o nome do evento")).toHaveAttribute("src", "/revela/ref/label-casamento.jpg");
    expect(screen.queryByText("espaço")).toBeNull();
    next();
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha o nome do evento");
    expect(screen.getByRole("heading", { name: "Nome do evento" })).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Sugestões de nome" }).querySelectorAll("button");
    expect(chips).toHaveLength(3);
    fireEvent.click(chips[0]);
    expect(screen.getByLabelText("Nome do evento")).toHaveValue("Casamento de Ana");
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } });
    next();
    expect(screen.getByRole("heading", { name: "Quando é a festa?" })).toBeInTheDocument();
  });
  it("8 · com código de cortesia guardado no aparelho, o passo do plano avisa que ele será aplicado", async () => {
    localStorage.setItem("mm-codigo-pendente", JSON.stringify({ c: "MMT-7KQ4-AB12", t: Date.now() }));
    try {
      render(<CreateWizard />);
      next();
      fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } });
      for (let i = 0; i < 6; i++) next();
      expect(await screen.findByTestId("aviso-codigo")).toHaveTextContent("Código de cortesia MMT-7KQ4-AB12 será aplicado ao criar o evento.");
    } finally { localStorage.clear(); }
  });
  it("8 · presente válido: um só cartão com o plano do código, sem preço, e o botão cria a câmera sem pagar", async () => {
    localStorage.setItem("mm-codigo-pendente", JSON.stringify({ c: "MMT-7KQ4-AB12", t: Date.now() }));
    mocks.peek.mockResolvedValue({ status: "ativo", planCode: "casamento", planName: "Casamento", maxGuests: 250, maxShots: 36 });
    try {
      render(<CreateWizard />);
      next();
      fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } });
      for (let i = 0; i < 6; i++) next();
      expect(await screen.findByText("Presente: plano Casamento, sem pagamento.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Criar câmera" })).toBeInTheDocument();
      expect(screen.queryByText(/R\$/)).toBeNull();
    } finally { localStorage.clear(); mocks.peek.mockReset(); mocks.peek.mockResolvedValue(null); }
  });
  it("8 · presente já usado: o código é descartado e o plano segue normal", async () => {
    localStorage.setItem("mm-codigo-pendente", JSON.stringify({ c: "MMT-7KQ4-AB12", t: Date.now() }));
    mocks.peek.mockResolvedValue({ status: "usado", planCode: "casamento", planName: "Casamento", maxGuests: 250, maxShots: 36 });
    try {
      render(<CreateWizard />);
      next();
      fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } });
      for (let i = 0; i < 6; i++) next();
      await waitFor(() => expect(screen.queryByTestId("aviso-codigo")).toBeNull());
      expect(screen.getByRole("button", { name: "Criar câmera" })).toBeInTheDocument();
    } finally { localStorage.clear(); mocks.peek.mockReset(); mocks.peek.mockResolvedValue(null); }
  });
  it("6 e 7 · filme e quem vê: escolhas viram campos do evento criado", async () => {
    render(<CreateWizard />);
    next();
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } });
    for (let i = 0; i < 4; i++) next(); // nome → festa → poses → revelar → filme
    expect(screen.getByRole("heading", { name: "Qual filme?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Filme 35mm" })).toBeChecked();
    expect(screen.getByAltText("Sem filme")).toHaveAttribute("src", "/revela/ref/sc-bolo-natural.jpg");
    expect(screen.getByAltText("Com filme 35mm")).toHaveAttribute("src", "/revela/ref/sc-bolo.jpg");
    fireEvent.click(screen.getByRole("radio", { name: "Natural" }));
    expect(screen.getByText(/^Natural: a foto como/)).toBeInTheDocument();
    next();
    expect(screen.getByRole("heading", { name: "Quem vê o quê" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Permitir baixar em alta" })).toBeChecked(); // padrão: permitido
    fireEvent.click(screen.getByRole("switch", { name: "Permitir baixar em alta" }));
    expect(screen.getByRole("switch", { name: "Permitir baixar em alta" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Convidados veem o feed" }));
    expect(screen.getByRole("switch", { name: "Convidados veem o feed" })).not.toBeChecked();
    next();
    fireEvent.click(await screen.findByRole("button", { name: "Criar câmera" }));
    expect(screen.queryByRole("dialog", { name: "Antes de criar" })).toBeNull(); // sem popup: continuar já é aceitar
    expect(screen.getByTestId("aviso-aceite")).toHaveTextContent("Ao continuar, você aceita os Termos de Uso e a Política de Privacidade");
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ title: "Ana & Leo", cameraStyle: "festa", filmLook: "natural", everyoneSeesAll: false, guestDownloadHigh: false });
  });
});
