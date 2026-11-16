// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Voce } from "./Voce";

vi.mock("next/link", () => ({ default: ({ children, ...p }: { children: React.ReactNode }) => <a {...p}>{children}</a> }));
vi.mock("../HostTabs", () => ({ HostTabs: () => null }));
afterEach(cleanup);

describe("Você (anfitrião)", () => {
  it("mostra o e-mail da conta e a foto do perfil quando existem", () => {
    const { container } = render(<Voce name="Ana" email="ana@exemplo.com" avatarUrl="https://lh3.googleusercontent.com/a/x" actions={{ "Nome e foto": () => {} }} />);
    expect(screen.getByTestId("voce-email").textContent).toBe("Entrou com ana@exemplo.com");
    expect(container.querySelector(".avatar img")?.getAttribute("src")).toBe("https://lh3.googleusercontent.com/a/x");
  });
  it("na tela real só aparecem as linhas que fazem algo, e só elas têm seta e papel de botão", () => {
    const nome = vi.fn();
    render(<Voce name="Ana" actions={{ "Nome e foto": nome, Sair: () => {} }} />);
    expect(screen.queryByText("Telefone")).toBeNull();
    expect(screen.queryByText("Ícone do app")).toBeNull();
    expect(screen.queryByText("Extras")).toBeNull(); // grupo vazio some com o título
    const linha = screen.getByRole("button", { name: /Nome e foto/ });
    fireEvent.click(linha);
    expect(nome).toHaveBeenCalledTimes(1);
    expect(linha.querySelector(".rv-row__end svg")).not.toBeNull();
    fireEvent.keyDown(linha, { key: "Enter" });
    expect(nome).toHaveBeenCalledTimes(2);
  });
  it("sem ações (desenho de referência) todas as linhas aparecem", () => {
    render(<Voce />);
    expect(screen.getByText("Telefone")).toBeTruthy();
    expect(screen.getByText("Ícone do app")).toBeTruthy();
  });
  it("a tela rola (a área .safe é rolável e deixa espaço para as abas)", () => {
    const { container } = render(<Voce actions={{ Sair: () => {} }} />);
    const safe = container.querySelector(".safe")!;
    expect(safe.classList.contains("safe--scroll")).toBe(true);
    expect(safe.classList.contains("safe--tabs")).toBe(true);
  });
});
