import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const app = {
  ready: true, user: { id: "u1", name: "Ana", createdAt: 1 } as { id: string; name: string; createdAt: number } | undefined,
  backend: "supabase" as "local" | "supabase", canSwitchIdentity: false, canCreate: false,
  repos: {} as unknown, now: () => 1_800_000_000_000, signOut: vi.fn(), scheduler: { schedule: vi.fn(), cancel: vi.fn() }, authority: { tick: vi.fn() },
  signInWithGoogle: vi.fn(), known: [], switchTo: vi.fn(), signIn: vi.fn(), persistent: true, storageError: false, ensureSession: vi.fn(),
};
let search = "";
let eventData: Record<string, unknown> = { loading: false, access: "inexistente", event: undefined, preview: undefined, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 }, refresh: vi.fn() };
let mode: "local" | "supabase" = "supabase";
let paramId = "nao-e-uuid";
const UUID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

vi.mock("@/features/app/provider", () => ({ useApp: () => app }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => mode, backendStatus: () => mode, supabaseConfig: () => (mode === "supabase" ? { url: "u", key: "k" } : null) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }), usePathname: () => "/painel/x", useParams: () => ({ id: paramId }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
vi.mock("@/features/app/hooks", async (orig) => ({ ...(await orig<typeof import("@/features/app/hooks")>()), useEventData: () => eventData, useClock: () => ({ now: 1, sync: vi.fn() }) }));
vi.mock("@/features/events/guest-context", () => ({ useGuest: () => ({ event: { id: "e1", code: "ABCD2345", shotsPerPerson: 10, revealStatus: "desativada", revealEnabled: false }, user: app.user, now: 1, photos: [], counts: { mine: 0, total: 0 }, isHost: false }) }));
vi.mock("@/features/studio/useBrandImages", () => ({ useBrandImages: () => ({}) }));
vi.mock("@/features/invitations/qr", () => ({ qrDataUrl: async () => "data:image/png;base64,AA==" }));

beforeEach(() => {
  mode = "supabase"; app.backend = "supabase"; app.canSwitchIdentity = false; app.canCreate = false; app.user = { id: "u1", name: "Ana", createdAt: 1 };
  app.repos = { events: { list: async () => [] }, participants: { get: async () => undefined } };
  search = ""; paramId = "nao-e-uuid";
  eventData = { loading: false, access: "inexistente", event: undefined, preview: undefined, participants: [], photos: [], reactions: [], counts: { mine: 0, total: 0 }, refresh: vi.fn() };
});

describe("voce (UX-01)", () => {
  it("a tela Você (23g) segue o desenho: nada de 'Entrar como outra pessoa' nem de Voltar ao início", async () => {
    process.env.NEXT_PUBLIC_MM_DEV_TOOLS = "1";
    const { default: Voce } = await import("./e/[code]/(app)/voce/page");
    app.canSwitchIdentity = true; mode = "local";
    render(<Voce />);
    expect(screen.queryByRole("button", { name: "Entrar como outra pessoa" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Você" })).toBeInTheDocument();
    expect(screen.getByText("Apagar meus dados")).toBeInTheDocument();
  });
});

describe("painel (UX-11, E5, UX-06)", () => {
  it("painel com id inválido mostra não encontrado", async () => {
    app.canCreate = true;
    const { default: Painel } = await import("./painel/[id]/layout");
    render(<Painel>x</Painel>);
    expect(screen.getByRole("heading", { name: "Não achamos este evento." })).toBeInTheDocument();
    expect(screen.getByText("Confira o link ou entre com a conta Google que criou o evento.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para meus eventos" })).toHaveAttribute("href", "/eventos");
    expect(document.body.textContent).not.toMatch(/neste aparelho/);
  });
  it("sem sessão de organizador na nuvem pede o login do Google", async () => {
    app.canCreate = false; paramId = UUID;
    const { default: Painel } = await import("./painel/[id]/layout");
    render(<Painel>x</Painel>);
    expect(screen.getByText("Entre com a conta Google que criou este evento.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Entrar com o Google/ }));
    expect(app.signInWithGoogle).toHaveBeenCalledWith(`/painel/${UUID}`);
  });
});

describe("home (UX-13, E6)", () => {
  it("home com ?erro=login mostra banner", async () => {
    search = "erro=login";
    const { default: Home } = await import("./page");
    render(<Home />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não conseguimos entrar com o Google. Tente de novo.");
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByText(/Não conseguimos entrar/)).toBeNull();
  });
  it("sem o parâmetro não há banner e não há guia nem exemplos sintéticos", async () => {
    process.env.NEXT_PUBLIC_MM_DEV_TOOLS = "1";
    const { default: Home } = await import("./page");
    render(<Home />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Guia de componentes|revelação em 2 minutos/i)).toBeNull();
    // a festa de exemplo em memória (S3) é um link visível para /exemplo, não um botão que grava dados
    expect(screen.getByRole("link", { name: "Experimentar câmera" })).toHaveAttribute("href", "/exemplo");
  });
  it("home não lista eventos; com sessão de anfitrião oferece Minhas câmeras", async () => {
    app.canCreate = true;
    const { default: Home } = await import("./page");
    render(<Home />);
    expect(screen.queryByRole("heading", { name: /Seus eventos|Festas em que você entrou/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Minhas câmeras" })).toHaveAttribute("href", "/eventos");
    expect(screen.getByRole("link", { name: "Montar câmera" })).toHaveAttribute("href", "/criar");
    expect(screen.getByRole("link", { name: "Tenho um convite" })).toHaveAttribute("href", "/entrar#codigo");
  });
  it("visitante sem sessão não vê Meus eventos", async () => {
    app.user = undefined;
    const { default: Home } = await import("./page");
    render(<Home />);
    expect(screen.queryByRole("link", { name: "Minhas câmeras" })).toBeNull();
  });
});

describe("criar/pronto (UX-12, O7)", () => {
  const ev = { id: "e1", code: "ABCD2345", title: "Ana & Rui", startAt: 1, place: "", palette: "salvia", eventFont: "birthstone", theme: undefined };
  it("clipboard negado não diz copiado", async () => {
    eventData = { ...eventData, event: ev, access: "organizador" };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("negado")) } });
    const { default: Pronto } = await import("./criar/pronto/[id]/page");
    render(<Pronto />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(await screen.findByText("Não conseguimos copiar. O link está selecionado.")).toBeInTheDocument();
    expect(screen.queryByText(/Link copiado/)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("link-convite")));
  });
  it("clipboard ok diz copiado", async () => {
    eventData = { ...eventData, event: ev, access: "organizador" };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { default: Pronto } = await import("./criar/pronto/[id]/page");
    render(<Pronto />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(await screen.findByText("Link copiado para a área de transferência.")).toBeInTheDocument();
  });
});

describe("textos por modo na tela", () => {
  it("código que não abre festa vai para a tela do código, em vermelho (20h), sem mencionar o aparelho", async () => {
    search = "erro=ZZZZ2222";
    const { default: Entrar } = await import("./entrar/page");
    render(<Entrar />);
    expect(screen.getByText("Esse código não abre nenhuma festa. Confira as letras no convite.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/neste aparelho/);
    search = "";
  });
  it("erro e offline na nuvem", async () => {
    const { default: Erro } = await import("./error");
    render(<Erro error={new Error("x")} reset={() => undefined} />);
    expect(screen.getByText("Algo deu errado. Suas fotos enviadas estão guardadas.")).toBeInTheDocument();
  });
});

describe("useEventData (UX-11)", () => {
  it("falha do repositório não deixa o carregamento infinito", async () => {
    vi.resetModules();
    vi.doUnmock("@/features/app/hooks");
    const hooks = await import("@/features/app/hooks");
    app.repos = { events: { get: async () => { throw new Error("invalid input syntax for type uuid"); }, getByCode: async () => { throw new Error("x"); } }, participants: {}, photos: {}, reactions: {}, users: {} };
    const { result } = renderHook(() => hooks.useEventData({ id: "7c9e6679-7425-40de-944b-e07fc1f90ae7" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.access).toBe("inexistente");
  });
});
