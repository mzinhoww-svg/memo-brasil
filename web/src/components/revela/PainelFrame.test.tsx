import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton, PainelFoot, PainelHeadAction, ScreenHeader } from "@/revela/painel-ui";
import { PainelFrame, type PainelTab } from "./PainelFrame";

const nav = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, back: nav.back }) }));

const tabs: PainelTab[] = [
  { href: "/painel/e1", label: "Geral", current: false },
  { href: "/painel/e1/conteudo", label: "Conteúdo", current: true, count: 2 },
  { href: "/painel/e1/qr", label: "QR", current: false },
];
const frame = (children: React.ReactNode = <p>corpo</p>) => (
  <PainelFrame title="Conteúdo" eventName="Nosso casamento" backHref="/painel/e1" tabs={tabs}>{children}</PainelFrame>
);
const css = readFileSync(join(process.cwd(), "src/styles/painel-frame.css"), "utf8");
const rule = (sel: string) => new RegExp(`${sel.replace(/[.[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

beforeEach(() => nav.push.mockClear());

describe("PainelFrame", () => {
  it("tem um único título (h1) e o nome do evento como subtítulo", () => {
    render(frame());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Conteúdo");
    expect(screen.getByText("Nosso casamento")).toBeInTheDocument();
  });

  it("não tem migalhas", () => {
    render(frame());
    expect(screen.queryByRole("navigation", { name: /migalhas|breadcrumb/i })).toBeNull();
    expect(screen.queryByText("Meus eventos")).toBeNull();
  });

  it("a seta leva à rota pai (router.push), nunca ao histórico", () => {
    render(frame());
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(nav.push).toHaveBeenCalledWith("/painel/e1");
    expect(nav.back).not.toHaveBeenCalled();
  });

  it("as abas marcam a atual com aria-current e mostram a contagem", () => {
    render(frame());
    const nav = screen.getByRole("navigation", { name: "Seções do painel" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((a) => a.textContent?.replace(/\d+$/, ""))).toEqual(["Geral", "Conteúdo", "QR"]);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"))).toEqual(["/painel/e1/conteudo"]);
    expect(screen.getByLabelText("2 pendentes")).toBeInTheDocument();
  });

  it("sem abas (erro, sem acesso) mostra só o cabeçalho", () => {
    render(<PainelFrame title="Painel do evento" backHref="/eventos"><p>x</p></PainelFrame>);
    expect(screen.queryByRole("navigation", { name: "Seções do painel" })).toBeNull();
  });

  it("rodapé opcional: vazio por padrão, e o conteúdo de PainelFoot vai para o rodapé fixo", async () => {
    const { container, rerender } = render(frame());
    const foot = container.querySelector(".pf-foot") as HTMLElement;
    expect(foot).not.toBeNull();
    expect(foot.childElementCount).toBe(0);
    rerender(frame(<PainelFoot><button type="button">Revelar agora</button></PainelFoot>));
    expect(await screen.findByRole("button", { name: "Revelar agora" })).toBeInTheDocument();
    expect(foot.contains(screen.getByRole("button", { name: "Revelar agora" }))).toBe(true);
  });

  it("a ação do cabeçalho (ScreenHeader embutido) sobe para o quadro e a tela não repete seta nem título", async () => {
    const { container } = render(frame(
      <>
        <ScreenHeader onBack={() => undefined} title="Outro título" action={<button type="button">Novo</button>} />
        <BackButton label="Voltar duplicada" />
        <PainelHeadAction><span>extra</span></PainelHeadAction>
      </>,
    ));
    expect(await screen.findByRole("button", { name: "Novo" })).toBeInTheDocument();
    expect(container.querySelector(".pf-action")?.contains(screen.getByRole("button", { name: "Novo" }))).toBe(true);
    expect(screen.queryByText("Outro título")).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar duplicada" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("fora do quadro, ScreenHeader e BackButton mantêm o desenho", () => {
    render(<ScreenHeader onBack={() => undefined} title="Convidados" />);
    expect(screen.getByRole("heading", { level: 1, name: "Convidados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  });

  it("a aba atual entra na vista ao montar (inline: center, block: nearest)", () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    render(frame());
    expect(spy).toHaveBeenCalledWith({ inline: "center", block: "nearest" });
  });
});

describe("painel-frame.css", () => {
  it("cabeçalho fixo (sticky) com a área segura do topo", () => {
    expect(rule(".pf-top")).toMatch(/position:\s*sticky/);
    expect(rule(".pf-top")).toContain("padding-top: env(safe-area-inset-top)");
  });
  it("corpo com respiro para a área segura de baixo", () => {
    expect(rule(".pf-body")).toContain("padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom))");
  });
  it("rodapé fixo opcional acima da área segura, medido em --pf-foot", () => {
    expect(rule(".pf-foot")).toMatch(/position:\s*sticky/);
    expect(rule(".pf-foot")).toContain("padding: var(--space-3) var(--space-4) max(12px, env(safe-area-inset-bottom))");
    expect(css).toContain("var(--pf-foot");
  });
  it("coluna de 480 px centralizada em qualquer largura e abas rolam com encaixe", () => {
    expect(rule(".pf")).toContain("max-width: 480px");
    expect(rule(".pf")).toContain("margin: 0 auto");
    expect(rule(".pf-tabs")).toContain("overflow-x: auto");
    expect(rule(".pf-tabs")).toContain("scroll-snap-type: x proximity");
  });
  it("sem cores literais (só tokens)", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
