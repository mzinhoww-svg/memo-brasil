import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "./Carousel";

const W = 350;

/** jsdom não tem layout: dá ao trilho slides de 350 px e uma rolagem que se pode mover à mão. */
function geometry(container: HTMLElement, count = 3) {
  const track = container.querySelector<HTMLElement>(".cx-track")!;
  let left = 0;
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: W },
    scrollWidth: { configurable: true, value: W * count },
    scrollLeft: { configurable: true, get: () => left, set: (v: number) => { left = v; } },
  });
  Array.from(track.children).forEach((c, i) => Object.defineProperties(c, { offsetLeft: { configurable: true, value: i * W }, offsetWidth: { configurable: true, value: W } }));
  return {
    scrollTo: (x: number) => { left = x; fireEvent.scroll(track); },
    get left() { return left; },
  };
}

const ui = (props: Partial<React.ComponentProps<typeof Carousel>> = {}) => (
  <Carousel count={3} label="Modelos" {...props}>
    {[1, 2, 3].map((n) => <div key={n}>{n}</div>)}
  </Carousel>
);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

let intoView: ReturnType<typeof vi.fn>;
beforeEach(() => {
  intoView = vi.fn();
  Element.prototype.scrollIntoView = intoView as unknown as Element["scrollIntoView"];
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

describe("Carousel", () => {
  it("bolinhas são botões com rótulo e aria-current no ativo", () => {
    render(ui({ index: 1 }));
    const dots = screen.getAllByRole("button", { name: /^Modelo \d de 3$/ });
    expect(dots.map((d) => d.getAttribute("aria-label"))).toEqual(["Modelo 1 de 3", "Modelo 2 de 3", "Modelo 3 de 3"]);
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    expect(dots[0]).not.toHaveAttribute("aria-current");
    expect(dots[0].tagName).toBe("BUTTON");
    expect(dots[0]).toHaveClass("cx-dot");
  });

  it("clicar numa bolinha chama onIndexChange e rola o slide ao centro com block nearest", async () => {
    const onIndexChange = vi.fn();
    render(ui({ onIndexChange }));
    await userEvent.click(screen.getByRole("button", { name: "Modelo 3 de 3" }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(intoView).toHaveBeenCalledWith({ behavior: "smooth", inline: "center", block: "nearest" });
    expect(screen.getByRole("button", { name: "Modelo 3 de 3" })).toHaveAttribute("aria-current", "true");
  });

  it("rolar o trilho atualiza o índice ativo uma vez", async () => {
    const onIndexChange = vi.fn();
    const { container } = render(ui({ onIndexChange }));
    const g = geometry(container);
    act(() => g.scrollTo(W));
    await waitFor(() => expect(onIndexChange).toHaveBeenCalledWith(1));
    expect(screen.getByRole("button", { name: "Modelo 2 de 3" })).toHaveAttribute("aria-current", "true");
    expect(onIndexChange).toHaveBeenCalledTimes(1);
  });

  it("rolagem feita por código não gera laço: ignora a rolagem até chegar ao destino", async () => {
    const onIndexChange = vi.fn();
    const { container } = render(ui({ onIndexChange }));
    const g = geometry(container);
    await userEvent.click(screen.getByRole("button", { name: "Modelo 3 de 3" }));
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    // no meio do caminho o trilho passa pelo slide 2: não pode notificar de novo
    act(() => g.scrollTo(W));
    await settle();
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    act(() => g.scrollTo(2 * W));
    await settle();
    expect(onIndexChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Modelo 3 de 3" })).toHaveAttribute("aria-current", "true");
  });

  it("setas Anterior e Próximo desabilitam nas pontas", async () => {
    const onIndexChange = vi.fn();
    const { container } = render(ui({ onIndexChange }));
    const g = geometry(container);
    act(() => g.scrollTo(0));
    const prev = screen.getByRole("button", { name: "Anterior" });
    const next = screen.getByRole("button", { name: "Próximo" });
    await waitFor(() => expect(next).toBeEnabled());
    expect(prev).toBeDisabled();
    await userEvent.click(next);
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(next);
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(next).toBeDisabled();
    // o navegador chega ao destino e a rolagem acompanha
    act(() => g.scrollTo(2 * W));
    await waitFor(() => expect(prev).toBeEnabled());
  });

  it("teclado no trilho: setas, Home e End", async () => {
    const onIndexChange = vi.fn();
    const { container } = render(ui({ onIndexChange }));
    container.querySelector<HTMLElement>(".cx-track")!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard("{End}");
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    await userEvent.keyboard("{ArrowLeft}");
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard("{Home}");
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it("teclado nas bolinhas move o foco junto", async () => {
    render(ui());
    screen.getByRole("button", { name: "Modelo 1 de 3" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Modelo 2 de 3" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Modelo 3 de 3" })).toHaveFocus();
  });

  it("posiciona o índice inicial sem animação", () => {
    const { container } = render(ui({ index: 2 }));
    expect(intoView).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Modelo 3 de 3" })).toHaveAttribute("aria-current", "true");
    expect(container.querySelector(".cx-track")).toBeTruthy();
  });

  it("prefers-reduced-motion: rola sem animação", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { container } = render(ui());
    const g = geometry(container);
    await userEvent.click(screen.getByRole("button", { name: "Modelo 2 de 3" }));
    expect(intoView).not.toHaveBeenCalled();
    expect(g.left).toBe(W);
  });

  it("mudar o índice por fora rola até o slide", () => {
    const { rerender } = render(ui({ index: 0 }));
    rerender(ui({ index: 2 }));
    expect(intoView).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Modelo 3 de 3" })).toHaveAttribute("aria-current", "true");
  });

  it("showArrows e showDots desligados não renderizam controles", () => {
    render(ui({ showArrows: false, showDots: false }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
