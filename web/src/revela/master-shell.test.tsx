// @vitest-environment jsdom
/* Menu do Master: trilho recolhível no desktop (escolha lembrada) e gaveta no celular (botão, Esc, fundo, link, foco, inert). */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MasterFrame } from "./master-kit";
import { RAIL_KEY } from "./master-menu";

type Listener = () => void;
let desktop = true;
const listeners = new Set<Listener>();
function setDesktop(v: boolean) {
  desktop = v;
  act(() => { listeners.forEach((l) => l()); });
}

beforeEach(() => {
  desktop = true;
  listeners.clear();
  window.localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return desktop; },
    media: query,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.overflow = ""; });

const frame = () => render(<MasterFrame links current="eventos"><p>conteúdo</p></MasterFrame>);
const dsk = (c: HTMLElement) => c.querySelector(".dsk") as HTMLElement;
const aside = (c: HTMLElement) => c.querySelector("aside.mside") as HTMLElement;
const toggle = () => screen.getByRole("button", { name: /(Recolher|Abrir) menu/ });

describe("desktop (≥ 1024 px): trilho recolhível", () => {
  it("um único menu no DOM, com os 13 itens, e o botão controla o menu", () => {
    const { container } = frame();
    expect(container.querySelectorAll("aside.mside")).toHaveLength(1);
    expect(container.querySelectorAll("aside.mside a.mnav")).toHaveLength(13);
    expect(toggle().getAttribute("aria-controls")).toBe(aside(container).id);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().getAttribute("aria-label")).toBe("Recolher menu");
    expect(aside(container).hasAttribute("inert")).toBe(false);
  });

  it("recolhe e expande pelo botão, mantendo rótulos acessíveis e title nos ícones", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    expect(dsk(container).getAttribute("data-rail")).toBe("1");
    expect(toggle().getAttribute("aria-label")).toBe("Abrir menu");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    const link = screen.getByRole("link", { name: "Eventos" });
    expect(link.getAttribute("title")).toBe("Eventos");
    expect(link.getAttribute("href")).toBe("/master/eventos");
    fireEvent.click(toggle());
    expect(dsk(container).getAttribute("data-rail")).toBe("0");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("a escolha fica no localStorage e vale ao montar de novo", () => {
    const first = frame();
    fireEvent.click(toggle());
    expect(window.localStorage.getItem(RAIL_KEY)).toBe("1");
    first.unmount();
    const second = frame();
    expect(dsk(second.container).getAttribute("data-rail")).toBe("1");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("sem localStorage (acessor lança) o menu ainda renderiza e alterna", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const { container } = frame();
    expect(aside(container)).toBeTruthy();
    const antes = dsk(container).getAttribute("data-rail"); // a memória da página pode vir de um teste anterior
    fireEvent.click(toggle());
    const depois = dsk(container).getAttribute("data-rail");
    expect(depois === "1" || depois === "0").toBe(true);
    expect(depois).not.toBe(antes);
    fireEvent.click(toggle());
    expect(dsk(container).getAttribute("data-rail")).not.toBe(depois);
  });

  it("o desktop não tem gaveta: não fica inert nem escondido", () => {
    const { container } = frame();
    expect(aside(container).getAttribute("aria-hidden")).toBeNull();
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
  });
});

describe("celular e tablet (< 1024 px): gaveta", () => {
  beforeEach(() => { desktop = false; });

  it("começa fechada: inert, aria-hidden e botão 'Abrir menu'", () => {
    const { container } = frame();
    expect(aside(container).hasAttribute("inert")).toBe(true);
    expect(aside(container).getAttribute("aria-hidden")).toBe("true");
    expect(toggle().getAttribute("aria-label")).toBe("Abrir menu");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBe(aside(container).id);
  });

  it("o botão abre a gaveta, leva o foco para dentro e trava a rolagem do fundo", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    expect(dsk(container).getAttribute("data-menu")).toBe("open");
    expect(aside(container).hasAttribute("inert")).toBe(false);
    expect(aside(container).getAttribute("aria-hidden")).toBeNull();
    expect(toggle().getAttribute("aria-label")).toBe("Recolher menu");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(aside(container).contains(document.activeElement)).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("Esc fecha, devolve o foco ao botão e destrava a rolagem", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
    expect(aside(container).hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(toggle());
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("tocar no fundo escurecido fecha e devolve o foco ao botão", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    fireEvent.click(container.querySelector(".mscrim")!);
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
    expect(document.activeElement).toBe(toggle());
  });

  it("o botão Fechar dentro da gaveta fecha", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
    expect(document.activeElement).toBe(toggle());
  });

  it("clicar num link do menu fecha a gaveta (a navegação segue pelo href)", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    const link = screen.getByRole("link", { name: "Pagamentos" });
    link.addEventListener("click", (e) => e.preventDefault()); // jsdom não navega
    fireEvent.click(link);
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
    expect(link.getAttribute("href")).toBe("/master/pagamentos");
  });

  it("Tab fica preso dentro da gaveta aberta (do último volta ao primeiro e vice-versa)", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    const items = [...aside(container).querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    const first = items[0], last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("ao crescer a janela até o desktop a gaveta aberta some e a rolagem volta", () => {
    const { container } = frame();
    fireEvent.click(toggle());
    setDesktop(true);
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
    expect(aside(container).hasAttribute("inert")).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    setDesktop(false);
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
  });

  it("a escolha do trilho do desktop não abre nem fecha a gaveta", () => {
    window.localStorage.setItem(RAIL_KEY, "1");
    const { container } = frame();
    expect(dsk(container).getAttribute("data-menu")).toBe("closed");
    expect(toggle().getAttribute("aria-label")).toBe("Abrir menu");
  });
});
