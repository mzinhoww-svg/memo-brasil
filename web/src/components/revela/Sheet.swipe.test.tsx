import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

const touch = (y: number) => ({ touches: [{ clientY: y }], changedTouches: [{ clientY: y }] });
function drag(el: Element, from: number, to: number, kind: "touchend" | "touchcancel" = "touchend") {
  fireEvent.touchStart(el, touch(from));
  fireEvent.touchMove(el, touch(from + (to - from) / 2));
  fireEvent.touchMove(el, touch(to));
  if (kind === "touchend") fireEvent.touchEnd(el, touch(to)); else fireEvent.touchCancel(el, touch(to));
}
const panel = () => screen.getByRole("dialog");
const handle = () => panel().querySelector(".app-sheet-handle")!;

describe("Sheet · arrastar para baixo", () => {
  it("arrastar a alça bem para baixo acompanha o dedo e fecha", async () => {
    const onClose = vi.fn();
    render(<Sheet title="Editar momento" onClose={onClose}><p>corpo</p></Sheet>);
    fireEvent.touchStart(handle(), touch(100));
    fireEvent.touchMove(handle(), touch(130));
    fireEvent.touchMove(handle(), touch(220));
    expect(panel().style.transform).toBe("translateY(120px)");
    fireEvent.touchEnd(handle(), touch(220));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("arrasto curto e lento volta ao lugar sem fechar", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><p>corpo</p></Sheet>);
    drag(handle(), 100, 140);
    await waitFor(() => expect(panel().style.transform).toBe(""));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("toque cancelado pelo sistema não fecha, só devolve a folha", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><p>corpo</p></Sheet>);
    drag(handle(), 100, 300, "touchcancel");
    await waitFor(() => expect(panel().style.transform).toBe(""));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("arrastar pelo corpo no topo da rolagem fecha; com o corpo já rolado, não", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><p>corpo</p></Sheet>);
    const body = screen.getByText("corpo");
    panel().scrollTop = 40;
    drag(body, 100, 300);
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(onClose).not.toHaveBeenCalled();
    expect(panel().style.transform).toBe("");
    panel().scrollTop = 0;
    drag(body, 100, 300);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("começar o toque num campo nunca arrasta a folha; a alça arrasta mesmo com o corpo rolado", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><input aria-label="Nome" /></Sheet>);
    drag(screen.getByLabelText("Nome"), 100, 300);
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(onClose).not.toHaveBeenCalled();
    panel().scrollTop = 60;
    drag(handle(), 100, 300);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("arrastar para cima ou com dois dedos não faz nada", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><p>corpo</p></Sheet>);
    drag(handle(), 300, 100);
    fireEvent.touchStart(handle(), { touches: [{ clientY: 100 }, { clientY: 120 }], changedTouches: [{ clientY: 100 }] });
    fireEvent.touchMove(handle(), { touches: [{ clientY: 300 }, { clientY: 320 }] });
    fireEvent.touchEnd(handle(), touch(300));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("se quem fecha recusar (ex.: gravando), a folha volta ao lugar", async () => {
    const onClose = vi.fn(); // recusa: não desmonta
    render(<Sheet title="T" onClose={onClose}><p>corpo</p></Sheet>);
    drag(handle(), 100, 300);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(panel().style.transform).toBe(""));
  });
});

const touchXY = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
const scrollable = (el: HTMLElement, axis: "y" | "x", scrolled = 0) => {
  el.style[axis === "y" ? "overflowY" : "overflowX"] = "auto";
  Object.defineProperty(el, axis === "y" ? "scrollHeight" : "scrollWidth", { value: 500, configurable: true });
  Object.defineProperty(el, axis === "y" ? "clientHeight" : "clientWidth", { value: 100, configurable: true });
  if (axis === "y") el.scrollTop = scrolled;
};

describe("Sheet · arrastar não rouba o gesto do conteúdo (U3)", () => {
  it("lista interna já rolada: arrastar para baixo rola a lista e não fecha a folha", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><div data-testid="lista"><p>item</p></div></Sheet>);
    const lista = screen.getByTestId("lista");
    scrollable(lista, "y", 40);
    drag(screen.getByText("item"), 100, 300);
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(onClose).not.toHaveBeenCalled();
  });
  it("carrossel horizontal: arrastar nele não fecha a folha", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><div data-testid="carrossel"><p>slide</p></div></Sheet>);
    scrollable(screen.getByTestId("carrossel"), "x");
    drag(screen.getByText("slide"), 100, 300);
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(onClose).not.toHaveBeenCalled();
  });
  it("gesto mais lateral que vertical no corpo não fecha; vertical de verdade fecha", async () => {
    const onClose = vi.fn();
    render(<Sheet title="T" onClose={onClose}><p>corpo</p></Sheet>);
    const body = screen.getByText("corpo");
    fireEvent.touchStart(body, touchXY(50, 100));
    fireEvent.touchMove(body, touchXY(250, 130));
    fireEvent.touchMove(body, touchXY(300, 300));
    fireEvent.touchEnd(body, touchXY(300, 300));
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.touchStart(body, touchXY(50, 100));
    fireEvent.touchMove(body, touchXY(55, 130));
    fireEvent.touchMove(body, touchXY(60, 300));
    fireEvent.touchEnd(body, touchXY(60, 300));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe("Sheet · foco, teclado e fundo (U4, U5, U7)", () => {
  it("o foco inicial e o Tab ignoram controles escondidos", () => {
    render(<Sheet title="T" onClose={() => {}}><div hidden><button>oculto</button></div><button>visível</button></Sheet>);
    expect(document.activeElement?.textContent).toBe("visível");
  });
  it("área visível curta (teclado em tela pequena) marca a folha como compacta; zoom por pinça não conta", () => {
    const listeners: Record<string, () => void> = {};
    const vv = { height: 300, offsetTop: 0, scale: 1, addEventListener: (k: string, f: () => void) => { listeners[k] = f; }, removeEventListener: () => {} };
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    const { container } = render(<Sheet title="T" onClose={() => {}}><p>corpo</p></Sheet>);
    const bd = container.querySelector(".app-dialog")!;
    expect(bd.hasAttribute("data-compact")).toBe(true);
    expect((bd as HTMLElement).style.getPropertyValue("--sheet-vh")).toBe("300px");
    vv.height = 700; listeners.resize?.();
    expect(bd.hasAttribute("data-compact")).toBe(false);
    vv.height = 300; vv.scale = 2; listeners.resize?.();
    expect(bd.hasAttribute("data-compact")).toBe(false); // pinça: ignora
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
  });
  it("em tela de toque o fundo é fixado enquanto a folha está aberta e volta ao fechar", () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("pointer: coarse"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    const { unmount } = render(<Sheet title="T" onClose={() => {}}><p>corpo</p></Sheet>);
    expect(document.body.style.position).toBe("fixed");
    unmount();
    expect(document.body.style.position).toBe("");
    expect(window.scrollTo).toHaveBeenCalled();
    window.matchMedia = mm;
  });
});
