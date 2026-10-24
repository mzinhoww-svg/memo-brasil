import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bars, Lines, niceMax } from "./charts";

describe("charts locais", () => {
  it("niceMax arredonda para cima", () => {
    expect([niceMax(0), niceMax(7), niceMax(130), niceMax(4100)]).toEqual([4, 10, 200, 5000]);
  });
  it("Bars: rótulo acessível, tooltip por dia e tabela oculta", () => {
    const { container } = render(<Bars title="Fotos por dia" name="Fotos" labels={["01/10", "02/10"]} values={[3, 5]} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Máximo 5");
    expect([...container.querySelectorAll("title")].map((t) => t.textContent)).toEqual(["01/10 · Fotos: 3", "02/10 · Fotos: 5"]);
    expect(screen.getByRole("table")).toBeTruthy();
  });
  it("Lines: legenda com 2 séries e tooltip com as duas", () => {
    const { container } = render(<Lines title="Acumulado" labels={["01/10", "02/10"]} series={[{ name: "Atual", values: [1, 3], color: 1 }, { name: "Anterior", values: [2, 2], color: 2, dashed: true }]} />);
    expect(screen.getByText("Atual: 3")).toBeTruthy();
    expect(screen.getByText("Anterior: 2")).toBeTruthy();
    expect(container.querySelector("title")?.textContent).toBe("01/10 · Atual: 1 · Anterior: 2");
  });
  it("sem dados mostra aviso", () => {
    render(<Bars title="Vazio" name="x" labels={[]} values={[]} />);
    expect(screen.getByText("Sem dados no período.")).toBeTruthy();
  });
});
