import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedRetrospectiva, type RetroBar } from "./FeedRetrospectiva";

const bar = (label: string, n: number, extra: Partial<RetroBar> = {}): RetroBar => ({ label, n, pct: n === 0 ? 0 : Math.max(8, n * 50), ...extra });

describe("FeedRetrospectiva · fotos por hora", () => {
  it("mostra o número sobre cada barra e esconde o 0", () => {
    render(<FeedRetrospectiva bars={[bar("18h", 0), bar("19h", 2, { on: true }), bar("20h", 0)]} />);
    const list = screen.getByRole("list", { name: "Fotos por hora" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[1]).getByText("2")).toBeInTheDocument();
    expect(items[0].querySelector("b")).toBeNull();
    expect(items[2].querySelector("b")).toBeNull();
  });
  it("cada barra tem aria-label com a hora e a contagem, no singular e no plural", () => {
    render(<FeedRetrospectiva bars={[bar("18h", 1), bar("19h", 2), bar("20h", 0), bar("21h", 3, { range: "21h às 23h" })]} />);
    expect(screen.getByLabelText("18h: 1 foto")).toBeInTheDocument();
    expect(screen.getByLabelText("19h: 2 fotos")).toBeInTheDocument();
    expect(screen.getByLabelText("20h: 0 fotos")).toBeInTheDocument();
    expect(screen.getByLabelText("21h às 23h: 3 fotos")).toBeInTheDocument();
  });
  it("mostra o dia na virada", () => {
    render(<FeedRetrospectiva bars={[bar("23h", 1), bar("0h", 1, { day: "dom" })]} />);
    expect(screen.getByText("dom")).toBeInTheDocument();
  });
  it("estado vazio: texto claro e nenhuma barra", () => {
    render(<FeedRetrospectiva bars={[]} />);
    expect(screen.getByText("Ainda não há fotos para contar.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Fotos por hora" })).toBeNull();
  });
  it("poucos dados: avisa; com bastante foto, não", () => {
    const { rerender } = render(<FeedRetrospectiva bars={[bar("19h", 2)]} />);
    expect(screen.getByText(/Ainda são poucas fotos/)).toBeInTheDocument();
    rerender(<FeedRetrospectiva bars={[bar("19h", 3), bar("20h", 4)]} />);
    expect(screen.queryByText(/Ainda são poucas fotos/)).toBeNull();
  });
  it("o pico em faixa e o título vêm das props", () => {
    render(<FeedRetrospectiva headline={["A festa", "em 1 foto"]} tiles={[{ label: "Pico (10 min)", value: "19:40–19:50", range: true }]} bars={[bar("19h", 1)]} />);
    expect(screen.getByText("Pico (10 min)")).toBeInTheDocument();
    expect(screen.getByText("19:40–19:50")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("A festaem 1 foto");
  });
});

describe("FeedRetrospectiva · seta de voltar", () => {
  it("mantém backHref como href real e, no toque simples, chama onBack sem navegar", () => {
    const onBack = vi.fn();
    render(<FeedRetrospectiva backHref="/e/ABCD2345/agora" onBack={onBack} bars={[]} />);
    const link = screen.getByRole("link", { name: "Voltar" });
    expect(link).toHaveAttribute("href", "/e/ABCD2345/agora");
    expect(fireEvent.click(link)).toBe(false); // preventDefault
    expect(onBack).toHaveBeenCalledTimes(1);
  });
  it("com tecla modificadora deixa o link abrir normalmente", () => {
    const onBack = vi.fn();
    render(<FeedRetrospectiva backHref="/e/ABCD2345/agora" onBack={onBack} bars={[]} />);
    fireEvent.click(screen.getByRole("link", { name: "Voltar" }), { ctrlKey: true });
    expect(onBack).not.toHaveBeenCalled();
  });
});
