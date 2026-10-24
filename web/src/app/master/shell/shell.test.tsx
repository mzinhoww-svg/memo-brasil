import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const nav = { path: "/master/revelacoes", search: new URLSearchParams("testes=1&dias=7&ord=title") };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => nav.path, useSearchParams: () => nav.search }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import { MasterNav } from "../MasterNav";
import { GROUPS, MODULES } from "../modules";
import { CommandSearch } from "./CommandSearch";
import { withShellParams } from "./params";
import { normalizeSearch } from "./search";

beforeEach(() => { push.mockClear(); nav.path = "/master/revelacoes"; nav.search = new URLSearchParams("testes=1&dias=7&ord=title"); });

describe("modules", () => {
  it("4 grupos cobrem os 15 módulos sem repetir rota", () => {
    expect(GROUPS.map((g) => g.rotulo)).toEqual(["Operação", "Pessoas", "Receita", "Plataforma"]);
    expect(MODULES).toHaveLength(15);
    expect(new Set(MODULES.map((m) => m.rota)).size).toBe(15);
    expect(GROUPS[1].modules.map((m) => m.rotulo)).toEqual(["Usuários", "Organizadores", "Participantes e convites", "Solicitações LGPD"]);
  });
});

describe("withShellParams", () => {
  it("leva testes e dias; descarta o resto", () => {
    expect(withShellParams("/master/eventos", { testes: "1", dias: "7", ord: "x", p: "2" })).toBe("/master/eventos?testes=1&dias=7");
    expect(withShellParams("/master", new URLSearchParams("dias=90"))).toBe("/master?dias=90");
    expect(withShellParams("/master", {})).toBe("/master");
  });
  it("parâmetros do href prevalecem e o hash é mantido", () => {
    expect(withShellParams("/master/eventos?ev=abc&dias=30#x", { dias: ["7"], testes: "1" })).toBe("/master/eventos?ev=abc&dias=30&testes=1#x");
  });
});

describe("MasterNav", () => {
  it("landmark, cabeçalhos de grupo não interativos e lista por grupo", () => {
    render(<MasterNav />);
    const n = screen.getByRole("navigation", { name: "Módulos do console" });
    for (const g of ["Operação", "Pessoas", "Receita", "Plataforma"]) {
      const h = within(n).getByRole("heading", { name: g });
      expect(h.closest("a,button")).toBeNull();
      expect(within(n).getByRole("list", { name: g })).toBeInTheDocument();
    }
    expect(within(n).getAllByRole("link")).toHaveLength(15);
  });

  it("aria-current só no módulo atual", () => {
    render(<MasterNav />);
    expect(screen.getByRole("link", { name: /^Revelações/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Visão geral/ })).not.toHaveAttribute("aria-current");
  });

  it("Visão geral fica atual na raiz", () => {
    nav.path = "/master";
    render(<MasterNav />);
    expect(screen.getByRole("link", { name: /^Visão geral/ })).toHaveAttribute("aria-current", "page");
  });

  it("links preservam testes e dias", () => {
    render(<MasterNav />);
    expect(screen.getByRole("link", { name: /^Eventos/ })).toHaveAttribute("href", "/master/eventos?testes=1&dias=7");
    expect(screen.getByRole("link", { name: /^Visão geral/ })).toHaveAttribute("href", "/master?testes=1&dias=7");
  });

  it("badges com valor visível, tom e rótulo acessível", () => {
    render(<MasterNav badges={{ revelacoes: { value: 3, severity: "warn", label: "3 pendentes, 1 atrasada" }, pagamentos: { value: "sandbox", severity: "warn" } }} />);
    const rev = screen.getByRole("link", { name: /Revelações.*3 pendentes, 1 atrasada/ });
    expect(rev.querySelector(".adm-nav-badge")).toHaveAttribute("data-tone", "warn");
    expect(screen.getByRole("link", { name: /Pagamentos\s*sandbox/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Eventos$/ }).querySelector(".adm-nav-badge")).toBeNull();
  });

  it("botão de menu é disclosure (aria-expanded/aria-controls) e Esc fecha", async () => {
    render(<MasterNav />);
    const b = screen.getByRole("button", { name: "Menu" });
    expect(b).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(b.getAttribute("aria-controls")!)).not.toBeNull();
    await userEvent.click(b);
    expect(screen.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(screen.getByRole("link", { name: /^Eventos/ }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
  });
});

describe("normalizeSearch", () => {
  it("limita a 5 por tipo e descarta itens sem id", () => {
    const ev = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, title: `T${i}` }));
    const r = normalizeSearch({ events: [...ev, { title: "sem id" }], users: [{ userId: "u1", email: "a***@b.c" }], orders: [{ id: "o1", eventId: null, status: "pago" }] });
    expect(r.events).toHaveLength(5);
    expect(r.users).toEqual([{ userId: "u1", email: "a***@b.c" }]);
    expect(r.orders).toEqual([{ id: "o1", eventId: null, status: "pago" }]);
    expect(normalizeSearch(null)).toEqual({ events: [], users: [], orders: [] });
  });
});

describe("CommandSearch", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      events: [{ id: "ev-1", title: "Casamento Ana" }, { id: "ev-2", title: "Formatura" }],
      users: [{ userId: "us-1", email: "a***@x.com" }],
      orders: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("abre com Ctrl+K e com ⌘K; foco no campo", async () => {
    render(<CommandSearch />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(document, { key: "K", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("botão visível abre; Esc fecha e devolve o foco ao botão", async () => {
    render(<CommandSearch />);
    const b = screen.getByRole("button", { name: /Buscar evento, e-mail, ID/ });
    await userEvent.click(b);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(b).toHaveFocus();
  });

  it("consulta com debounce, uma chamada por termo, à rota /master/busca", async () => {
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    await userEvent.type(screen.getByRole("combobox"), "ana");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/master/busca?q=ana");
  });

  it("termo curto não consulta", async () => {
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    await userEvent.type(screen.getByRole("combobox"), "a");
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Digite ao menos 2 caracteres.");
  });

  it("setas movem a seleção (com volta) e Enter navega preservando testes/dias", async () => {
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "ana");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    const opts = screen.getAllByRole("option");
    expect(opts[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", opts[0].id);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[2].id);
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/master/usuarios?q=us-1&testes=1&dias=7");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("evento leva a /master/eventos?ev=<id>; clique também navega", async () => {
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    await userEvent.type(screen.getByRole("combobox"), "ana");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    await userEvent.click(screen.getByRole("option", { name: /Formatura/ }));
    expect(push).toHaveBeenCalledWith("/master/eventos?ev=ev-2&testes=1&dias=7");
  });

  it("Tab fica preso no diálogo", async () => {
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    const input = screen.getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
  });

  it("modo degradado avisa e nada encontrado mostra mensagem", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ events: [], users: [], orders: [], degraded: true }), { status: 200 }));
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('Nada encontrado para "zzz".'));
    expect(screen.getByText(/Busca parcial/)).toBeInTheDocument();
  });

  it("erro da rota vira mensagem, sem quebrar", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 403 }));
    render(<CommandSearch />);
    await userEvent.click(screen.getByRole("button", { name: /Buscar evento/ }));
    await userEvent.type(screen.getByRole("combobox"), "ana");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Recarregue a página/));
  });
});
