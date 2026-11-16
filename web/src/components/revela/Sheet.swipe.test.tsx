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
