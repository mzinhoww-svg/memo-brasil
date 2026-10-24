import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/master/eventos", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import { Sheet } from "@/components/memoriesmt/Sheet";
import { Drawer } from "../kit/Drawer";
import { CommandSearch } from "./CommandSearch";

beforeEach(() => push.mockClear());

/** Só o diálogo do topo trata Tab/Esc (⌘K aberto sobre o drawer ou sobre uma folha de confirmação). */
describe("pilha de modais", () => {
  it("⌘K sobre o drawer: Esc fecha só a busca, o drawer fica", async () => {
    render(<><CommandSearch /><Drawer title="Festa" closeHref="/master/eventos"><button>Ação</button></Drawer></>);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Busca no console" })).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Festa" })).toBeInTheDocument();
    // com a busca fechada, o drawer volta a tratar o Esc
    await userEvent.keyboard("{Escape}");
    expect(push).toHaveBeenCalledWith("/master/eventos");
  });

  it("⌘K sobre o drawer: Tab fica dentro da busca", async () => {
    render(<><CommandSearch /><Drawer title="Festa" closeHref="/master/eventos"><button>Ação</button></Drawer></>);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    const busca = screen.getByRole("dialog", { name: "Busca no console" });
    await userEvent.tab();
    expect(busca.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    expect(busca.contains(document.activeElement)).toBe(true);
    await userEvent.tab({ shift: true });
    expect(busca.contains(document.activeElement)).toBe(true);
  });

  it("⌘K sobre uma folha: Esc fecha só a busca e a justificativa digitada fica", async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return <><CommandSearch />{open && <Sheet title="Revelar agora" onClose={() => setOpen(false)}><textarea aria-label="Justificativa" /></Sheet>}</>;
    }
    render(<Host />);
    const just = screen.getByRole("textbox", { name: "Justificativa" });
    await userEvent.type(just, "Anfitriã pediu");
    fireEvent.keyDown(just, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Busca no console" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Revelar agora" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveValue("Anfitriã pediu");
    // o foco volta para onde estava (dentro da folha), não para o gatilho da busca atrás dela
    expect(screen.getByRole("textbox", { name: "Justificativa" })).toHaveFocus();
  });

  it("folha aberta sobre o drawer: Esc fecha só a folha", async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer title="Festa" closeHref="/master/eventos">
          <button>Ação</button>
          {open && <Sheet title="Confirmar" onClose={() => setOpen(false)}><button>Ok</button></Sheet>}
        </Drawer>
      );
    }
    render(<Host />);
    screen.getByRole("button", { name: "Ok" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Confirmar" })).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
