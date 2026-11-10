import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedPost, FEED_REF_POSTS } from "./FeedEvento";
import { FeedReacoes } from "./FeedReacoes";

describe("Baixar em alta no feed", () => {
  it("sem permissão o botão some; com permissão tem o nome Baixar em alta", () => {
    const post = FEED_REF_POSTS[0];
    const { rerender } = render(<FeedPost post={{ ...post, canDownload: false }} />);
    expect(screen.queryByRole("button", { name: /Baixar/ })).toBeNull();
    rerender(<FeedPost post={{ ...post, canDownload: true, downloadLabel: "Baixar em alta" }} />);
    expect(screen.getByRole("button", { name: "Baixar em alta" })).toBeInTheDocument();
    rerender(<FeedPost post={post} />);
    expect(screen.getByRole("button", { name: "Baixar" })).toBeInTheDocument(); // desenho de referência intacto
  });
  it("foto aberta: mesma regra", () => {
    const { rerender } = render(<FeedReacoes canDownload={false} />);
    expect(screen.queryByRole("button", { name: /Baixar/ })).toBeNull();
    rerender(<FeedReacoes downloadLabel="Baixar em alta" />);
    expect(screen.getByRole("button", { name: "Baixar em alta" })).toBeInTheDocument();
  });
});
