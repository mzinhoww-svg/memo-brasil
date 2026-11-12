import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AnfitriaoModerar, MODERAR_REF, type ModItem } from "./AnfitriaoModerar";

const many = (n: number): ModItem[] => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, src: `/f${i}.jpg`, name: "Ana", when: "21:00" }));
const read = (f: string) => readFileSync(join(process.cwd(), "src/styles", f), "utf8");

describe("AnfitriaoModerar (Conteúdo)", () => {
  it("61 ou mais fotos: o botão 'Ver mais fotos' aparece e pede a próxima página", () => {
    const onMore = vi.fn();
    render(<AnfitriaoModerar items={many(60)} count="61 fotos · 0 removidas" onMore={onMore} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver mais fotos" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("até 60 fotos não oferece 'Ver mais fotos'", () => {
    render(<AnfitriaoModerar items={many(60)} />);
    expect(screen.queryByRole("button", { name: "Ver mais fotos" })).toBeNull();
  });

  it("carrega mais ao chegar ao fim da lista (IntersectionObserver)", () => {
    let fire: (e: Partial<IntersectionObserverEntry>[]) => void = () => undefined;
    class IO { constructor(cb: IntersectionObserverCallback) { fire = (e) => cb(e as IntersectionObserverEntry[], this as unknown as IntersectionObserver); } observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } }
    vi.stubGlobal("IntersectionObserver", IO);
    const onMore = vi.fn();
    render(<AnfitriaoModerar items={many(60)} onMore={onMore} />);
    fire([{ isIntersecting: false }]);
    expect(onMore).not.toHaveBeenCalled();
    fire([{ isIntersecting: true }]);
    expect(onMore).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("a tela não é um quadro de altura fixa: o contêiner rola com a página (CSS)", () => {
    const { container } = render(<AnfitriaoModerar items={many(61)} />);
    expect(container.querySelector(".scr.cont")).not.toBeNull();
    // no painel, .scr perde height/overflow fixos: dentro do quadro e no escopo antigo
    expect(read("painel-frame.css")).toMatch(/\.pf \.scr, \.pf \.scr\.sheet-scr \{[^}]*height: auto;[^}]*overflow: visible/);
    expect(read("painel-scope.css")).toMatch(/\.painel-scope \.scr:not\(\.sheet-scr\),[\s\S]*?\{ height: auto; min-height: 100dvh; overflow: visible; \}/);
    expect(container.querySelectorAll(".cont-tile")).toHaveLength(61);
  });

  it("cada foto mostra autor e hora e é um botão com nome acessível", () => {
    render(<AnfitriaoModerar items={MODERAR_REF.items} onItem={() => undefined} />);
    expect(screen.getByRole("button", { name: "Foto de Bia, 21:42" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Foto de Leo, 21:31, removida do álbum/ })).toBeInTheDocument();
  });
});
