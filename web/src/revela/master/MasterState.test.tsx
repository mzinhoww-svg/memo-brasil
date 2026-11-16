// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MasterState, MasterStatePage, skeletonWidth } from "./MasterState";

afterEach(cleanup);

describe("MasterState: os quatro estados", () => {
  it("vazio: título e texto da tela, sem botão", () => {
    const { container } = render(<MasterState variant="empty" title="Nenhuma conta neste filtro" text="Troque o filtro ou limpe a busca." />);
    expect(container.querySelector(".mstate")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Nenhuma conta neste filtro" })).toBeTruthy();
    expect(screen.getByText("Troque o filtro ou limpe a busca.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("erro: texto fixo e 'Tentar de novo' chama onRetry", () => {
    const retry = vi.fn();
    render(<MasterState variant="error" onRetry={retry} />);
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    expect(screen.getByText("Os dados não chegaram. Nada foi alterado.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it("sem permissão: texto fixo, sem botão", () => {
    render(<MasterState variant="denied" />);
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    expect(screen.getByText("Seu papel não dá acesso a esta área. Fale com um master se precisar.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("carregando: 8 linhas de esqueleto com as colunas da tabela, ocupado para leitor de tela", () => {
    const { container } = render(<MasterState variant="loading" cols={5} />);
    const t = screen.getByLabelText("Carregando");
    expect(t.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".mtr")).toHaveLength(8);
    expect(container.querySelectorAll(".msk")).toHaveLength(40);
    expect((container.querySelector(".mtr") as HTMLElement).style.gridTemplateColumns).toBe("1fr 1fr 1fr 1fr 1fr");
  });
  it("as larguras do esqueleto repetem as do desenho", () => {
    expect([0, 1, 2, 3, 4, 5].map((c) => skeletonWidth(0, c))).toEqual([40, 63, 86, 59, 82, 55]);
    expect([0, 1, 2, 3, 4, 5, 6].map((c) => skeletonWidth(1, c))).toEqual([77, 50, 73, 46, 69, 42, 65]);
    expect(skeletonWidth(7, 6)).toBe(87);
  });
});

describe("MasterStatePage: o título é o da ÁREA", () => {
  it("sem permissão mostra o nome da área e legenda '—', sem ações", () => {
    render(<MasterStatePage variant="denied" area="Eventos" actions={<button>Exportar</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Eventos" })).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });
  it("vazio e carregando mantêm as ações do cabeçalho; erro não", () => {
    const a = <button>Exportar</button>;
    const { rerender } = render(<MasterStatePage variant="empty" area="Pessoas" actions={a} caption="Todas as contas" />);
    expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
    expect(screen.getByText("Todas as contas")).toBeTruthy();
    rerender(<MasterStatePage variant="loading" area="Pessoas" actions={a} />);
    expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
    rerender(<MasterStatePage variant="error" area="Pessoas" actions={a} />);
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });
  it("mostra as abas acima do estado", () => {
    render(<MasterStatePage variant="empty" area="Pessoas" tabs={<div role="tablist" aria-label="abas" />} />);
    expect(screen.getByRole("tablist", { name: "abas" })).toBeTruthy();
  });
});
