import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedEvento, FeedPost, FEED_REF_POSTS } from "./FeedEvento";

describe("cartão do feed fluido", () => {
  it("a foto não tem largura nem altura fixas no style inline e mantém transform, camada e cursor", () => {
    const { container } = render(<FeedPost post={FEED_REF_POSTS[0]} onOpen={() => undefined} />);
    const print = container.querySelector(".rv-print") as HTMLElement;
    expect(print.classList.contains("rv-print--feed")).toBe(true);
    expect(print.style.width).toBe("");
    expect(print.style.height).toBe("");
    expect(print.style.transform).toBe("rotate(0deg)");
    expect(print.style.zIndex).toBe("1");
    expect(print.style.cursor).toBe("pointer");
  });
  it("legenda, véu e ações continuam no cartão", () => {
    const { container } = render(<FeedPost post={{ ...FEED_REF_POSTS[0], veiled: true }} />);
    expect(container.querySelector(".rv-print__cap")).not.toBeNull();
    expect(container.querySelector(".rvm-lock")).not.toBeNull();
    for (const n of ["Curtir", "Comentar", "Compartilhar", "Baixar", "Mais"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
  });
  it("com rolagem, o feed reserva a barra de abas pela classe (sem 92px inline)", () => {
    const { container } = render(<FeedEvento scroll />);
    const safe = container.querySelector(".safe") as HTMLElement;
    expect(safe.classList.contains("safe--tabs")).toBe(true);
    expect(safe.style.paddingBottom).toBe("");
  });
  it("expõe o contêiner que rola por scrollRef e onScroll", () => {
    const ref = createRef<HTMLDivElement>();
    const onScroll = vi.fn();
    const { container } = render(<FeedEvento scroll scrollRef={ref} onScroll={onScroll} />);
    const safe = container.querySelector(".safe") as HTMLElement;
    expect(ref.current).toBe(safe);
    fireEvent.scroll(safe);
    expect(onScroll).toHaveBeenCalledTimes(1);
  });
  it("sem as props novas a tela segue igual", () => {
    const { container } = render(<FeedEvento />);
    expect(container.querySelector(".safe")).not.toBeNull();
  });
  it("o nome acessível da foto é curto: só 'Abrir a foto de {autor}'", () => {
    render(<FeedPost post={FEED_REF_POSTS[0]} onOpen={() => undefined} />);
    const btn = screen.getByRole("button", { name: "Abrir a foto de Leo" });
    expect(btn.getAttribute("aria-label")).toBe("Abrir a foto de Leo");
    // o botão não contém o carimbo: a regra de nome x conteúdo visível não se aplica a ele
    expect(btn.textContent).toBe("");
  });
});
