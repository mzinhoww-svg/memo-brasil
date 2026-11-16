import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanCards } from "./PlanCards";
import { PLANS_REF } from "./screens/CameraPublicar";

let intoView: ReturnType<typeof vi.fn>;
beforeEach(() => {
  intoView = vi.fn();
  Element.prototype.scrollIntoView = intoView as unknown as Element["scrollIntoView"];
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

function Harness({ onSelect }: { onSelect?: (c: string) => void }) {
  const [sel, setSel] = useState("festa");
  return <PlanCards plans={PLANS_REF} selected={sel} onSelect={(c) => { setSel(c); onSelect?.(c); }} />;
}

describe("PlanCards", () => {
  it("radiogroup com um radio por plano, nome 'Plano, preço' e aria-checked", () => {
    render(<PlanCards plans={PLANS_REF} selected="casamento" />);
    expect(screen.getByRole("radiogroup", { name: "Plano do evento" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Casamento, R$ 189" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Festa, R$ 29" })).toHaveAttribute("aria-checked", "false");
  });

  it("tabIndex: só o marcado entra na ordem de tab", () => {
    render(<PlanCards plans={PLANS_REF} selected="casamento" />);
    expect(screen.getByRole("radio", { name: "Casamento, R$ 189" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Festa, R$ 29" })).toHaveAttribute("tabindex", "-1");
  });

  it("toque seleciona e centraliza o cartão (inline center, block nearest)", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    intoView.mockClear();
    await userEvent.click(screen.getByRole("radio", { name: "Grande, R$ 349" }));
    expect(onSelect).toHaveBeenCalledWith("grande");
    expect(intoView).toHaveBeenCalledWith({ behavior: "smooth", inline: "center", block: "nearest" });
  });

  it("Enter e Espaço selecionam", async () => {
    const onSelect = vi.fn();
    render(<PlanCards plans={PLANS_REF} selected="festa" onSelect={onSelect} />);
    screen.getByRole("radio", { name: "Celebração, R$ 89" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenNthCalledWith(1, "celebracao");
    expect(onSelect).toHaveBeenNthCalledWith(2, "celebracao");
  });

  it("setas movem a seleção como radiogroup, com volta nas pontas", async () => {
    render(<Harness />);
    screen.getByRole("radio", { name: "Festa, R$ 29" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Celebração, R$ 89" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Celebração, R$ 89" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Grátis, Grátis" })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Grande, R$ 349" })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Grátis, Grátis" })).toHaveAttribute("aria-checked", "true");
  });

  it("rolar o trilho nunca seleciona", () => {
    const onSelect = vi.fn();
    const { container } = render(<PlanCards plans={PLANS_REF} selected="festa" onSelect={onSelect} />);
    const track = container.querySelector(".cx-track")!;
    track.dispatchEvent(new Event("scroll", { bubbles: true }));
    track.dispatchEvent(new Event("scrollend"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Festa, R$ 29" })).toHaveAttribute("aria-checked", "true");
  });
});
