import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/master/eventos", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import { AlertBar } from "./AlertBar";
import { BarLineChart } from "./BarLineChart";
import { CsvButton } from "./CsvButton";
import { Drawer } from "./Drawer";
import { Kpi, deltaOf } from "./Kpi";
import { Meter } from "./Meter";
import { PeriodTabs } from "./PeriodTabs";
import { SortableTable } from "./SortableTable";
import { TestToggle } from "./TestToggle";
import { hrefWith, parseSort, sortRows } from "./url";

beforeEach(() => push.mockClear());

describe("Kpi", () => {
  it("delta positivo: sinal + e tom ok", () => {
    render(<Kpi label="Fotos" value="120" current={120} previous={100} spark={[1, 2, 3]} />);
    const d = screen.getByText(/\+20%/);
    expect(d).toHaveAttribute("data-tone", "ok");
  });
  it("delta negativo: sinal - e tom crit; lowerIsBetter inverte", () => {
    const { unmount } = render(<Kpi label="A" value="8" current={80} previous={100} />);
    expect(screen.getByText(/-20%/)).toHaveAttribute("data-tone", "crit");
    unmount();
    render(<Kpi label="Falhas" value="8" current={80} previous={100} lowerIsBetter />);
    expect(screen.getByText(/-20%/)).toHaveAttribute("data-tone", "ok");
  });
  it("sem anterior não mostra delta; anterior zero vira novo", () => {
    expect(deltaOf(5, null)).toBeNull();
    expect(deltaOf(5, 0)?.text).toBe("novo");
    expect(deltaOf(0, 0)?.text).toBe("0%");
    expect(deltaOf(10, 10)?.tone).toBe("dim");
  });
  it("sparkline destaca o último ponto", () => {
    const { container } = render(<Kpi label="A" value="1" spark={[1, 5, 2]} />);
    expect(container.querySelectorAll("svg circle")).toHaveLength(1);
  });
});

describe("AlertBar", () => {
  it("renderiza título, texto e link com cta", () => {
    render(<AlertBar alerts={[{ severity: "crit", title: "2 revelações atrasadas", text: "Maior atraso 40 min", href: "/master/revelacoes", cta: "Ver revelações" }]} />);
    expect(screen.getByText("2 revelações atrasadas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver revelações" })).toHaveAttribute("href", "/master/revelacoes");
    expect(screen.getByText("Crítico")).toBeInTheDocument();
  });
  it("lista vazia não renderiza", () => {
    const { container } = render(<AlertBar alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Drawer", () => {
  it("é um diálogo nomeado e Esc navega para closeHref", () => {
    render(<Drawer title="Festa da Ana" closeHref="/master/eventos?q=a"><button>Ação</button></Drawer>);
    expect(screen.getByRole("dialog", { name: "Festa da Ana" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/master/eventos?q=a");
  });
  it("botão Fechar aponta para closeHref", () => {
    render(<Drawer title="X" closeHref="/master/eventos"><p>corpo</p></Drawer>);
    expect(screen.getByRole("link", { name: "Fechar" })).toHaveAttribute("href", "/master/eventos");
  });
  it("prende o foco: Tab no último volta ao primeiro", async () => {
    const user = userEvent.setup();
    render(<Drawer title="X" closeHref="/m"><button>Último</button></Drawer>);
    screen.getByRole("button", { name: "Último" }).focus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Fechar" })).toHaveFocus();
  });
});

describe("TestToggle", () => {
  it("padrão (sem testes): ligado e o link liga testes=1 preservando os demais", () => {
    render(<TestToggle path="/master/eventos" params={{ q: "ana", p: "3" }} />);
    const l = screen.getByRole("switch", { name: "Ocultar testes" });
    expect(l).toHaveAttribute("aria-checked", "true");
    expect(l).toHaveAttribute("href", "/master/eventos?q=ana&testes=1");
  });
  it("com testes=1: desligado e o link remove o parâmetro", () => {
    render(<TestToggle path="/master/eventos" params={{ q: "ana", testes: "1" }} />);
    const l = screen.getByRole("switch");
    expect(l).toHaveAttribute("aria-checked", "false");
    expect(l).toHaveAttribute("href", "/master/eventos?q=ana");
  });
});

describe("PeriodTabs", () => {
  it("monta os hrefs preservando parâmetros e marca o atual", () => {
    render(<PeriodTabs path="/master" params={{ testes: "1", dias: "7" }} />);
    expect(screen.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "90 dias" })).toHaveAttribute("href", "/master?testes=1&dias=90");
  });
  it("padrão é 30 dias", () => {
    render(<PeriodTabs path="/master" params={{}} />);
    expect(screen.getByRole("link", { name: "30 dias" })).toHaveAttribute("aria-current", "page");
  });
});

describe("SortableTable", () => {
  const cols = [{ key: "nome", label: "Nome" }, { key: "n", label: "Qtd", num: true }, { key: "x", label: "Ação", sortable: false }];
  const rows = [{ nome: "Ana", n: 3, x: "a" }, { nome: "Bia", n: 1, x: "b" }];
  it("cabeçalhos ordenáveis são links; ativa alterna a direção e marca aria-sort", () => {
    render(<SortableTable cols={cols} rows={rows} path="/master/eventos" params={{ q: "z", p: "2" }} ord="nome" dir="asc" empty={{ title: "Nada" }} />);
    expect(screen.getByRole("link", { name: /Nome/ })).toHaveAttribute("href", "/master/eventos?q=z&ord=nome&dir=desc");
    expect(screen.getByRole("link", { name: "Qtd" })).toHaveAttribute("href", "/master/eventos?q=z&ord=n&dir=asc");
    expect(screen.getByRole("columnheader", { name: /Nome/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.queryByRole("link", { name: "Ação" })).toBeNull();
  });
  it("sem linhas mostra o estado vazio", () => {
    render(<SortableTable cols={cols} rows={[]} path="/m" params={{}} empty={{ title: "Nenhum evento", text: "Ajuste os filtros." }} />);
    expect(screen.getByText("Nenhum evento")).toBeInTheDocument();
  });
  it("helpers de URL e ordenação", () => {
    expect(hrefWith("/m", { a: "1" }, { a: null })).toBe("/m");
    expect(parseSort({ ord: "zzz" }, ["n"], { ord: "n", dir: "desc" })).toEqual({ ord: "n", dir: "desc" });
    expect(parseSort({ ord: "n", dir: "asc" }, ["n"], { ord: "n", dir: "desc" })).toEqual({ ord: "n", dir: "asc" });
    expect(sortRows(rows, "n", "asc").map((r) => r.nome)).toEqual(["Bia", "Ana"]);
  });
});

describe("CsvButton", () => {
  it("gera o CSV com BOM, ; e proteção de fórmula", async () => {
    let blob: Blob | undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => { blob = b as Blob; return "blob:x"; });
    URL.revokeObjectURL = vi.fn();
    render(<CsvButton filename="eventos" rows={[{ nome: "=1+1", n: 2 }]} cols={[{ key: "nome", label: "Nome" }, { key: "n", label: "Qtd" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(click).toHaveBeenCalled();
    const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(blob!, "utf-8"); });
    expect(text).toContain("Nome;Qtd\r\n'=1+1;2");
    click.mockRestore();
  });
  it("desabilitado sem linhas", () => {
    render(<CsvButton filename="x" rows={[]} cols={[{ key: "a" as never, label: "A" }]} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("gráficos", () => {
  it("BarLineChart tem role=img, aria-label e tabela de dados", () => {
    render(<BarLineChart title="Atividade" names={{ a: "Fotos", b: "Entradas", line: "Eventos" }} data={[{ label: "01/10", a: 3, b: 1, line: 2 }, { label: "02/10", a: 5, b: 2, line: 1 }]} />);
    expect(screen.getByRole("img", { name: /Atividade.*01\/10 a 02\/10/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Atividade" })).toBeInTheDocument();
  });
  it("Meter expõe valores e tom crítico acima de 95%", () => {
    render(<Meter label="Capacidade" value={96} max={100} />);
    expect(screen.getByRole("meter", { name: "Capacidade" })).toHaveAttribute("aria-valuenow", "96");
    expect(document.querySelector(".adm-meter")).toHaveAttribute("data-tone", "crit");
  });
});
