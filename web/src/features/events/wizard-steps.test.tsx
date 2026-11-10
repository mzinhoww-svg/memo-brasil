import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), lookup: vi.fn(), save: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/criar" }));
vi.mock("@/features/app/provider", () => ({ useApp: () => ({ repos: { events: { getByCode: mocks.lookup, save: mocks.save } }, user: { id: "u", name: "Ana" }, signIn: mocks.signIn, now: () => 1800000000000, ready: true, backend: "local", canCreate: true }) }));
vi.mock("@/features/billing/api", async (orig) => ({ ...(await orig<typeof import("@/features/billing/api")>()), listPublicPlans: async () => [{ code: "gratis", name: "Grátis", isFree: true, maxShots: 10, maxGuests: 10, priceCents: 0, features: [] }], getPublicSettings: async () => ({}) }));
import { CreateWizard } from "./wizard";
const next = () => fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.signIn.mockResolvedValue({ id: "u", name: "Ana" }); mocks.lookup.mockResolvedValue(null); mocks.save.mockImplementation(async (e) => e); });

describe("passos 1, 2, 6 e 7 do assistente (telas 07, 08, 12, 13)", () => {
  it("1 · embalagem: amostras do desenho; escolher troca a câmera, o nome e o texto", () => {
    render(<CreateWizard />);
    expect(screen.getByRole("heading", { name: "Escolha a embalagem" })).toBeInTheDocument();
    expect(screen.getByText("1/8")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Festa", "Casamento", "Aniversário", "Noite"]);
    fireEvent.click(screen.getByRole("radio", { name: "Casamento" }));
    expect(screen.getByRole("radio", { name: "Casamento" })).toBeChecked();
    expect(screen.getByText("Marfim com faixa dourada. O nome do casal sai impresso.")).toBeInTheDocument();
    expect(screen.getByAltText("Câmera com embalagem Casamento")).toHaveAttribute("src", "/revela/ref/cam-casamento.webp");
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
  it("6 e 7 · filme e quem vê: escolhas viram campos do evento criado", async () => {
    render(<CreateWizard />);
    next();
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Ana & Leo" } });
    for (let i = 0; i < 4; i++) next(); // nome → festa → poses → revelar → filme
    expect(screen.getByRole("heading", { name: "Qual filme?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Filme 35mm" })).toBeChecked();
    expect(screen.getByAltText("Sem filme")).toHaveAttribute("src", "/revela/ref/sc-bolo-natural.jpg");
    expect(screen.getByAltText("Com filme 35mm")).toHaveAttribute("src", "/revela/lut/amostra-bolo-filme35.jpg");
    fireEvent.click(screen.getByRole("radio", { name: "Natural" }));
    expect(screen.getByText(/^Natural: a foto como/)).toBeInTheDocument();
    next();
    expect(screen.getByRole("heading", { name: "Quem vê o quê" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Permitir baixar em alta" })).toBeNull(); // sem campo no evento: a linha fica escondida no assistente
    fireEvent.click(screen.getByRole("switch", { name: "Convidados veem o feed" }));
    expect(screen.getByRole("switch", { name: "Convidados veem o feed" })).not.toBeChecked();
    next();
    fireEvent.click(await screen.findByRole("button", { name: "Criar câmera" }));
    const dialog = screen.getByRole("dialog", { name: "Antes de criar" });
    Array.from(dialog.querySelectorAll<HTMLInputElement>("input[type=checkbox]")).forEach((c) => fireEvent.click(c));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ title: "Ana & Leo", cameraStyle: "festa", filmLook: "natural", everyoneSeesAll: false });
  });
});
