import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useFlash } from "@/revela/painel-ui";
import { readFileSync } from "node:fs";
import { ConfirmSheet } from "./ConfirmSheet";
import { Sheet } from "./Sheet";

const wait = (ms = 90) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function Stack({ onInner }: { onInner?: () => void }) {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(false);
  return (
    <>
      {outer && (
        <Sheet title="Fora" onClose={() => setOuter(false)}>
          <button type="button" onClick={() => setInner(true)}>Abrir dentro</button>
        </Sheet>
      )}
      {inner && <ConfirmSheet title="Dentro" onCancel={() => { onInner?.(); setInner(false); }} onConfirm={() => undefined} />}
    </>
  );
}

describe("Sheet", () => {
  it("rodapé fica fora da rolagem do conteúdo e o painel marca data-footer", () => {
    render(<Sheet title="T" onClose={() => undefined} footer={<button type="button">Salvar</button>}><p>corpo</p></Sheet>);
    const panel = screen.getByRole("dialog");
    expect(panel.hasAttribute("data-footer")).toBe(true);
    expect(panel.querySelector(".app-dialog-foot")?.textContent).toBe("Salvar");
  });

  it("Esc fecha só a folha de cima", async () => {
    const inner = vi.fn();
    render(<Stack onInner={inner} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir dentro" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(inner).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(screen.getByRole("dialog", { name: "Fora" })).toBeInTheDocument();
  });

  it("trava a rolagem do fundo enquanto houver folha e solta depois da última", async () => {
    document.body.style.overflow = "";
    const { unmount } = render(<Stack />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir dentro" }));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("folha com history: o voltar fecha a folha; ao fechar por dentro a entrada do histórico é devolvida", async () => {
    await wait();
    const close = vi.fn();
    const { unmount } = render(<Sheet title="H" history onClose={close}><button type="button">x</button></Sheet>);
    expect((window.history.state as { mmSheet?: boolean } | null)?.mmSheet).toBe(true);
    await act(async () => { window.history.back(); await new Promise((r) => setTimeout(r, 30)); });
    expect(close).toHaveBeenCalledTimes(1);
    unmount();
    await wait();
    expect((window.history.state as { mmSheet?: boolean } | null)?.mmSheet).not.toBe(true);
  });

  it("folha com history fechada por dentro não deixa entrada sobrando", async () => {
    await wait();
    const { unmount } = render(<Sheet title="H" history onClose={() => undefined}><button type="button">x</button></Sheet>);
    expect((window.history.state as { mmSheet?: boolean } | null)?.mmSheet).toBe(true);
    unmount();
    await wait(150);
    expect((window.history.state as { mmSheet?: boolean } | null)?.mmSheet).not.toBe(true);
  });

  it("sem history o botão voltar do navegador não é tocado", async () => {
    await wait();
    const push = vi.spyOn(window.history, "pushState");
    render(<Sheet title="S" onClose={() => undefined}><button type="button">x</button></Sheet>);
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });
});

describe("aviso curto (useFlash)", () => {
  it("fica acima das folhas (z-index maior que o do diálogo) e é anunciado", () => {
    function T() { const [node, flash] = useFlash(); return <><button type="button" onClick={() => flash("Salvo.")}>go</button>{node}</>; }
    render(<T />);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    const toast = screen.getByRole("status");
    expect(toast.textContent).toBe("Salvo.");
    const css = readFileSync(`${process.cwd()}/src/styles/app.css`, "utf8");
    const dialogZ = Number(/\.app-dialog \{[^}]*z-index: (\d+)/.exec(css)?.[1]);
    expect(Number((toast.parentElement as HTMLElement).style.zIndex)).toBeGreaterThan(dialogZ);
  });
});
