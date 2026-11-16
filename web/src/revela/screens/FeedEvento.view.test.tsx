import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("../GuestTabs", () => ({ GuestTabs: () => null }));
import { FeedEvento, type FeedPostData } from "./FeedEvento";

const post = (id: string, author: string): FeedPostData => ({ id, avatar: author[0], author, pose: `pose 1 de 10`, imageSrc: `https://x/${id}.thumb`, stampLeft: "", stampRight: author, liked: false, likesText: "0 curtidas", commentsText: "Comentar" });
const posts = [post("a", "Ana"), post("b", "Beto"), post("c", "Clara")];

describe("FeedEvento · formato do feed", () => {
  it("sem onView: só a lista, sem a chave (a referência de desenho não muda)", () => {
    const { container } = render(<FeedEvento posts={posts} />);
    expect(screen.queryByRole("group", { name: "Formato do feed" })).toBeNull();
    expect(container.querySelectorAll("article.post")).toHaveLength(3);
  });

  it("lista: mostra a chave com Lista marcada e as publicações grandes", () => {
    const { container } = render(<FeedEvento posts={posts} onView={() => undefined} view="lista" />);
    expect(screen.getByRole("button", { name: "Ver em lista" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ver em grade" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll("article.post")).toHaveLength(3);
    expect(screen.queryByTestId("feed-grade")).toBeNull();
  });

  it("grade: uma miniatura por foto, sem publicações; tocar abre a foto; a chave troca o formato", () => {
    const onOpen = vi.fn();
    const onView = vi.fn();
    const { container } = render(<FeedEvento posts={posts} view="grade" onView={onView} onOpen={onOpen} />);
    expect(screen.getByRole("button", { name: "Ver em grade" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll("article.post")).toHaveLength(0);
    const itens = screen.getByTestId("feed-grade").querySelectorAll("button.feed-grid__item");
    expect(itens).toHaveLength(3);
    expect(itens[1].querySelector("img")).toHaveAttribute("src", "https://x/b.thumb");
    fireEvent.click(screen.getByRole("button", { name: "Abrir a foto de Beto, pose 1 de 10" }));
    expect(onOpen).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByRole("button", { name: "Ver em lista" }));
    expect(onView).toHaveBeenCalledWith("lista");
  });
});
