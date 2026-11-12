import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
