import fs from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, Chip, GoogleButton, Sheet, Stepper, TabBar, Tabs } from "@/components/revela";
import { Cam3D } from "@/components/revela/Cam3D";
import { MCard, Tiles } from "@/revela/master-kit";
import { WizardSheet } from "@/revela/WizardSheet";
import { WizardDirection } from "@/revela/wizard-motion";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => h("a", { href, ...p }, children) }));

const styles = (f: string) => fs.readFileSync(path.resolve(__dirname, "../../styles", f), "utf8");

describe("rv-press nos botões dos componentes compartilhados", () => {
  it("Button (botão e link), Chip, Stepper, GoogleButton, Tabs e TabBar", () => {
    const html = renderToStaticMarkup(h("div", null,
      h(Button, null, "A"), h(Button, { href: "/x", variant: "cta", children: "B" }),
      h(Chip, null, "C"), h(GoogleButton),
      h(Stepper, { label: "n", value: 2, min: 1, max: 5, onChange: () => undefined, decrementLabel: "menos", incrementLabel: "mais" }),
      h(Tabs, { base: "b", label: "t", value: "a", onChange: () => undefined, tabs: [{ id: "a", label: "A" }] }),
      h(TabBar, { items: [{ href: "/a", label: "A", icon: "camera" }] }),
    ));
    const dom = new DOMParser().parseFromString(html, "text/html");
    for (const sel of [".rv-btn", ".rv-chip", ".rv-google", ".rv-step-btn", ".rvl-tab", ".rv-tabbar-item"]) {
      const els = dom.querySelectorAll(sel);
      expect(els.length, sel).toBeGreaterThan(0);
      els.forEach((el) => expect(el.classList.contains("rv-press"), sel).toBe(true));
    }
  });

  it("o CSS aplicado repete o transition e o :active do .rv-press nos botões do app", () => {
    const apply = styles("revela-motion-apply.css");
    for (const sel of [".rv-btn", ".rv-icon-btn", ".rv-tab"]) {
      expect(apply).toContain(`${sel}:active`);
    }
    expect(apply).toContain("transform var(--rv-t-tap) var(--rv-ease-out), filter var(--rv-t-tap)");
    expect(apply).toMatch(/transform: scale\(\.96\);\s*filter: brightness\(\.92\)/);
  });

  it("as animações antigas equivalentes saíram dos estilos do app", () => {
    for (const f of ["revela.css", "app.css", "revela2.css", "revela-guest.css"]) {
      const css = styles(f);
      expect(css, f).not.toMatch(/@keyframes (rv-flash|rv-confetti-cai|confetti-cai|rv-develop|develop|pulse|rv-pulso)\b/);
    }
  });
});

describe("rv-rise e esteira de listas", () => {
  it("cartões e tiles do Master entram com rv-rise e atraso --i", () => {
    const html = renderToStaticMarkup(h("div", null, h(MCard, { index: 2, children: "x" }), h(Tiles, { items: [{ label: "a", value: "1" }, { label: "b", value: "2" }] })));
    const dom = new DOMParser().parseFromString(html, "text/html");
    const card = dom.querySelector(".mcard") as HTMLElement;
    expect(card.classList.contains("rv-rise")).toBe(true);
    expect(card.style.getPropertyValue("--i")).toBe("2");
    const tiles = Array.from(dom.querySelectorAll(".tile")) as HTMLElement[];
    expect(tiles.map((t) => t.classList.contains("rv-rise"))).toEqual([true, true]);
    expect(tiles.map((t) => t.style.getPropertyValue("--i"))).toEqual(["0", "1"]);
  });
});

describe("folha", () => {
  it("usa rv-sheet-motion e rv-backdrop com data-open (abre no quadro seguinte)", async () => {
    render(h(Sheet, { title: "Titulo", onClose: () => undefined, children: "corpo" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("rv-sheet-motion");
    expect(dialog.parentElement).toHaveClass("rv-backdrop", "app-dialog");
    await waitFor(() => expect(dialog).toHaveAttribute("data-open", "true"));
    expect(dialog.parentElement).toHaveAttribute("data-open", "true");
  });
});

describe("assistente", () => {
  it("passo novo: rv-rise no primeiro, rv-step com data-dir ao avançar/voltar; traços rv-seg com data-on", async () => {
    const { container, rerender } = render(h(WizardSheet, { step: 3, title: "t", caption: "c", children: "corpo" }));
    expect(container.querySelector(".sheet-body")).toHaveClass("rv-rise");
    const segs = () => Array.from(container.querySelectorAll(".rv-steps i.rv-seg"));
    expect(segs()).toHaveLength(8);
    await waitFor(() => expect(segs().map((s) => s.getAttribute("data-on"))).toEqual(["true", "true", "true", "false", "false", "false", "false", "false"]));
    for (const dir of ["next", "back"] as const) {
      rerender(h(WizardDirection.Provider, { value: dir }, h(WizardSheet, { step: 3, title: "t", caption: "c", children: "corpo" })));
      const body = container.querySelector(".sheet-body")!;
      expect(body).toHaveClass("rv-step");
      expect(body).toHaveAttribute("data-dir", dir);
    }
  });
});

describe("câmera 3D", () => {
  it("entra com rv-cam-in, flutua com rv-float e a imagem fica numa camada própria (tilt/flip)", () => {
    const { container } = render(h(Cam3D, { src: "/a.webp", alt: "Câmera", width: 200, flip: true }));
    const root = container.firstElementChild!;
    expect(root).toHaveClass("rv-cam-in");
    expect(root.querySelector(".rv-float > img")).toHaveAttribute("src", "/a.webp");
    expect(root.querySelector("img")).toHaveClass("rv-tilt");
  });
});
