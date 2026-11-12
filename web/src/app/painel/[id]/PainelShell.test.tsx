import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  path: "/painel/e1", push: vi.fn(),
  data: {} as Record<string, unknown>,
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "e1" }), usePathname: () => m.path, useRouter: () => ({ push: m.push }) }));
vi.mock("@/features/app/provider", () => ({
  useApp: () => ({ ready: true, user: { id: "h" }, repos: {}, now: () => 0, authority: { tick: async () => undefined }, backend: "local", canCreate: true, signInWithGoogle: vi.fn() }),
}));
vi.mock("@/features/app/hooks", () => ({
  formatDate: () => "01/01", isUuid: () => true, useClock: () => ({ now: 0, sync: vi.fn() }),
  useEventData: () => m.data,
}));
const event = { id: "e1", code: "ABC", title: "Nosso casamento", hostId: "h", cameraStyle: "festa", startAt: 0, durationHours: 3, revealEnabled: false, revealAt: null, revealStatus: "desativada", timezone: "UTC" };
const loaded = { loading: false, error: undefined, access: "dono", event, photos: [{ id: "p", status: "visivel", reports: 2 }], reactions: [], participants: [], refresh: vi.fn() };

const { PainelShell, FRAME_ROUTES, SECTIONS } = await import("./PainelShell");

beforeEach(() => { m.data = { ...loaded }; m.push.mockClear(); });

describe("PainelShell: rotas migradas para o PainelFrame", () => {
  it.each(Object.keys(FRAME_ROUTES))("/%s: sem migalhas, exatamente um h1 e as abas do painel", (slug) => {
    m.path = `/painel/e1/${slug}`;
    render(<PainelShell><p>corpo da tela</p></PainelShell>);
    expect(screen.queryByRole("navigation", { name: "Trilha de navegação" })).toBeNull();
    expect(screen.queryByText("Meus eventos")).toBeNull();
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe(FRAME_ROUTES[slug].title);
    const tabs = screen.getByRole("navigation", { name: "Seções do painel" });
    expect(within(tabs).getAllByRole("link")).toHaveLength(SECTIONS.length);
    expect(screen.getByText("corpo da tela")).toBeInTheDocument();
    expect(screen.getByText("Nosso casamento")).toBeInTheDocument(); // nome do evento como subtítulo
  });

  it("a aba da seção atual leva aria-current; telas sem aba (Moderação) não marcam nenhuma", () => {
    m.path = "/painel/e1/conteudo";
    const { unmount } = render(<PainelShell><p>x</p></PainelShell>);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.getAttribute("href"))).toEqual(["/painel/e1/conteudo"]);
    expect(screen.getByLabelText("1 pendentes")).toBeInTheDocument(); // foto denunciada na aba Conteúdo
    unmount();
    m.path = "/painel/e1/moderacao";
    render(<PainelShell><p>x</p></PainelShell>);
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page")).toHaveLength(0);
  });

  it("rótulos curtos nas abas (QR em vez de QR Code Studio)", () => {
    m.path = "/painel/e1/conteudo";
    render(<PainelShell><p>x</p></PainelShell>);
    const labels = within(screen.getByRole("navigation", { name: "Seções do painel" })).getAllByRole("link").map((a) => a.textContent?.replace(/\d+$/, ""));
    expect(labels).toEqual(["Geral", "Plano", "Conteúdo", "Convidados", "Momentos", "QR", "Aparência", "Ajustes", "Downloads"]);
  });

  it.each([
    ["conteudo", "/painel/e1"], ["configuracoes", "/painel/e1"], ["convidados", "/painel/e1"],
    ["aparencia", "/painel/e1/configuracoes"], ["excluir", "/painel/e1/configuracoes"], ["convite", "/painel/e1/convites"],
  ])("a seta de /%s leva à rota pai (%s) por router.push", (slug, parent) => {
    m.path = `/painel/e1/${slug}`;
    render(<PainelShell><p>x</p></PainelShell>);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(m.push).toHaveBeenCalledWith(parent);
  });

  it("Plano e QR estão no quadro, com a seta na rota pai (Ajustes, Plano, Convites)", () => {
    expect(FRAME_ROUTES.plano).toEqual({ title: "Plano", parent: "configuracoes" });
    expect(FRAME_ROUTES["checkout-validapay"]).toBeUndefined();
    expect(FRAME_ROUTES.qr).toEqual({ title: "QR para as mesas", parent: "convites" });
  });

  it.each([
    ["plano", "/painel/e1/configuracoes"], ["qr", "/painel/e1/convites"],
  ])("/%s: quadro sem menu lateral nem migalhas, e a seta leva a %s", (slug, parent) => {
    m.path = `/painel/e1/${slug}`;
    const { container } = render(<PainelShell><p>x</p></PainelShell>);
    expect(container.querySelector(".pf")).not.toBeNull();
    expect(container.querySelector(".app-admin, .painel-scope")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Trilha de navegação" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(m.push).toHaveBeenCalledWith(parent);
  });

  it("o pagamento é tela cheia: sem quadro, abas nem migalhas, só o escopo do painel", () => {
    m.path = "/painel/e1/checkout-validapay";
    const { container } = render(<PainelShell><p>pagamento</p></PainelShell>);
    expect(container.querySelector(".pf")).toBeNull();
    expect(container.querySelector(".painel-scope")).not.toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("pagamento")).toBeInTheDocument();
  });

  it("visão geral: no quadro, h1 único com o nome do evento, aba Geral atual e seta para Meus eventos", () => {
    m.path = "/painel/e1";
    const { container } = render(<PainelShell><p>corpo</p></PainelShell>);
    expect(container.querySelector(".pf")).not.toBeNull();
    expect(container.querySelector(".painel-scope")).toBeNull();
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Nosso casamento");
    const tabs = within(screen.getByRole("navigation", { name: "Seções do painel" })).getAllByRole("link");
    expect(tabs).toHaveLength(SECTIONS.length);
    expect(tabs.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"))).toEqual(["/painel/e1"]);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(m.push).toHaveBeenCalledWith("/eventos");
  });

  it("rota desconhecida do painel também abre no quadro, com a seta no painel inicial", () => {
    m.path = "/painel/e1/inexistente";
    const { container } = render(<PainelShell><p>x</p></PainelShell>);
    expect(container.querySelector(".pf")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(m.push).toHaveBeenCalledWith("/painel/e1");
  });
});

describe("PainelShell: estados do shell no quadro", () => {
  it("carregando a visão geral: quadro com abas e esqueleto, sem tela solta", () => {
    m.path = "/painel/e1";
    m.data = { ...loaded, loading: true };
    const { container } = render(<PainelShell><p>x</p></PainelShell>);
    expect(container.querySelector(".pf")).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Seções do painel" })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("carregando: o quadro da rota migrada com esqueleto do corpo", () => {
    m.path = "/painel/e1/conteudo";
    m.data = { ...loaded, loading: true };
    const { container } = render(<PainelShell><p>x</p></PainelShell>);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Conteúdo");
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Abrindo o painel…");
  });

  it("erro: um h1 no quadro, tentar de novo e sem abas", () => {
    m.path = "/painel/e1/conteudo";
    m.data = { ...loaded, event: undefined, error: "unavailable" };
    render(<PainelShell><p>x</p></PainelShell>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Não deu para carregar o evento.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Seções do painel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect((m.data as { refresh: ReturnType<typeof vi.fn> }).refresh).toHaveBeenCalled();
  });

  it("sem permissão: quadro com a mensagem e o caminho para a festa", () => {
    m.path = "/painel/e1";
    m.data = { ...loaded, event: { ...event, hostId: "outro" } };
    const { container } = render(<PainelShell><p>x</p></PainelShell>);
    expect(container.querySelector(".pf")).not.toBeNull();
    expect(screen.getByText("Só o anfitrião abre o painel.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar na festa" })).toHaveAttribute("href", "/e/ABC");
  });
});
