import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PagamentoTrocarPlano } from "./PagamentoTrocarPlano";
import { PlanoConteudo } from "./PlanoConteudo";

describe("PlanoConteudo (miolo do painel)", () => {
  it("traz plano atual, medidores, aviso, 'Aumentar para', cartões e a nota de pagamento", () => {
    render(<PlanoConteudo />);
    expect(screen.getByText("Plano atual")).toBeInTheDocument();
    expect(screen.getByText("Festa · R$ 29")).toBeInTheDocument();
    expect(screen.getByText("28 de 30")).toBeInTheDocument();
    expect(screen.getByText(/Faltam 2 lugares/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Aumentar para" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Plano do evento" })).toBeInTheDocument();
    expect(screen.getByText("Pix ou cartão, sem sair do app")).toBeInTheDocument();
  });

  it("não tem `.scr`, cabeçalho, seta de voltar, título nem botão", () => {
    const { container } = render(<PlanoConteudo />);
    expect(container.querySelector(".scr, .safe, .home-ind, .grain")).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
    expect(screen.queryByText("Plano do evento")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("button", { name: /Trocar|Escolher/ })).toBeNull();
  });

  it("o erro entra no fluxo como alerta; sem erro, não há alerta", () => {
    const { rerender } = render(<PlanoConteudo error={undefined} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<PlanoConteudo error="Este evento já terminou. Não dá para mudar o plano." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Este evento já terminou");
  });

  it("os filhos vêm depois do erro (lugar do botão na tela inteira)", () => {
    render(<PlanoConteudo error="falhou"><button type="button">fim</button></PlanoConteudo>);
    const alert = screen.getByRole("alert");
    const end = screen.getByRole("button", { name: "fim" });
    expect(alert.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("PagamentoTrocarPlano compõe o PlanoConteudo na tela inteira do desenho", () => {
  it("`.scr` com cabeçalho, seta, título 'Plano do evento' e o botão no fim", () => {
    const onBack = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(<PagamentoTrocarPlano onBack={onBack} onConfirm={onConfirm} error="x" />);
    expect(container.querySelector(".scr > .safe")).not.toBeNull();
    expect(screen.getByText("Plano do evento")).toBeInTheDocument();
    expect(screen.getByText("Aumentar para")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
    const cta = screen.getByRole("button", { name: "Trocar para Celebração · R$ 89" });
    expect(screen.getByRole("alert").compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(cta);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("busy desabilita o botão", () => {
    render(<PagamentoTrocarPlano busy cta="Abrindo pagamento…" />);
    expect(screen.getByRole("button", { name: "Abrindo pagamento…" })).toBeDisabled();
  });
});
