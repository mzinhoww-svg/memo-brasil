import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QRConvite } from "./QRConvite";

const W = 350;
const COPIES = ["Texto um", "Texto dois", "Texto três", "Texto quatro"];

function geometry(container: HTMLElement, count = 4) {
  const track = container.querySelector<HTMLElement>(".cx-track")!;
  let left = 0;
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: W },
    scrollWidth: { configurable: true, value: W * count },
    scrollLeft: { configurable: true, get: () => left, set: (v: number) => { left = v; } },
  });
  Array.from(track.children).forEach((c, i) => Object.defineProperties(c, { offsetLeft: { configurable: true, value: i * W }, offsetWidth: { configurable: true, value: W } }));
  return { scrollTo: (x: number) => { left = x; fireEvent.scroll(track); } };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn() as unknown as Element["scrollIntoView"];
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

describe("QRConvite", () => {
  it("renderiza um cartão por modelo, cada um com o seu texto", () => {
    render(<QRConvite copies={COPIES} model={1} />);
    for (const t of COPIES) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /^Modelo \d de 4$/ })).toHaveLength(4);
  });

  it("sem copies, todos os cartões usam copy", () => {
    render(<QRConvite copy="Igual" />);
    expect(screen.getAllByText("Igual")).toHaveLength(4);
  });

  it("legenda e bolinhas: botões 'Modelo i de N' com aria-current no modelo", () => {
    render(<QRConvite model={3} />);
    expect(screen.getAllByText("Modelo 3 de 4").length).toBeGreaterThan(0);
    const dots = screen.getAllByRole("button", { name: /^Modelo \d de 4$/ });
    expect(dots).toHaveLength(4);
    expect(dots[2]).toHaveAttribute("aria-current", "true");
    expect(dots[0].tagName).toBe("BUTTON");
  });

  it("clicar na bolinha i chama onModel(i+1)", async () => {
    const onModel = vi.fn();
    render(<QRConvite onModel={onModel} />);
    await userEvent.click(screen.getByRole("button", { name: "Modelo 4 de 4" }));
    expect(onModel).toHaveBeenCalledWith(4);
  });

  it("deslizar o trilho atualiza o modelo (legenda, bolinha e onModel)", async () => {
    const onModel = vi.fn();
    const { container } = render(<QRConvite copies={COPIES} model={2} onModel={onModel} />);
    const g = geometry(container);
    act(() => g.scrollTo(2 * W));
    await waitFor(() => expect(onModel).toHaveBeenCalledWith(3));
    expect(screen.getByRole("button", { name: "Modelo 3 de 4" })).toHaveAttribute("aria-current", "true");
    expect(container.querySelector(".rv-caption")).toHaveTextContent("Modelo 3 de 4");
  });

  it("renderiza o QR só no modelo ativo e nos vizinhos", () => {
    render(<QRConvite model={1} models={5} />);
    expect(screen.getAllByRole("img", { name: "QR code do evento" })).toHaveLength(2);
  });

  it("Baixar QR code entrega o modelo ativo", async () => {
    const onDownload = vi.fn();
    render(<QRConvite model={3} onDownload={onDownload} />);
    await userEvent.click(screen.getByRole("button", { name: /Baixar QR code/ }));
    expect(onDownload).toHaveBeenCalledWith(3);
  });

  it("botão de proporção mostra o estado em texto", async () => {
    const onRatio = vi.fn();
    const { rerender } = render(<QRConvite onRatio={onRatio} />);
    const btn = screen.getByRole("button", { name: "Proporção: retrato" });
    expect(btn).toHaveTextContent("Retrato");
    await userEvent.click(btn);
    expect(onRatio).toHaveBeenCalled();
    rerender(<QRConvite square onRatio={onRatio} />);
    expect(screen.getByRole("button", { name: "Proporção: quadrado" })).toHaveTextContent("Quadrado");
  });

  it("o modelo volta a seguir a prop quando o pai muda", async () => {
    function Parent() {
      const [m, setM] = useState(1);
      return (<><button type="button" onClick={() => setM(4)}>ir</button><QRConvite model={m} onModel={setM} /></>);
    }
    render(<Parent />);
    await userEvent.click(screen.getByRole("button", { name: "ir" }));
    expect(screen.getByRole("button", { name: "Modelo 4 de 4" })).toHaveAttribute("aria-current", "true");
  });
});
