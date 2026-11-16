import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestProvider, type GuestCtx } from "@/features/events/guest-context";
import { GuestTabs } from "@/revela/GuestTabs";

const ctx = { event: { id: "ev1", code: "ABC123" }, isHost: false, viewer: { id: "u", host: false } } as unknown as GuestCtx;
const tabs = (current: Parameters<typeof GuestTabs>[0]["current"] = "feed") => render(<GuestProvider value={ctx}><GuestTabs code="ABC123" current={current} /></GuestProvider>);

afterEach(() => vi.unstubAllEnvs());

describe("aba Minhas Fotos", () => {
  it("chave desligada (padrão): a barra continua Feed, Minhas, Você", () => {
    tabs();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Feed", "Fotos", "Você"]);
  });
  it("chave ligada (modo local): Minhas Fotos entra depois de Minhas, sem tirar nenhuma aba", () => {
    vi.stubEnv("NEXT_PUBLIC_MM_SMART_ALBUM", "ui");
    tabs("fotos");
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Feed", "Fotos", "Minhas Fotos", "Você"]);
    const link = screen.getByRole("link", { name: "Minhas Fotos" });
    expect(link.getAttribute("href")).toBe("/e/ABC123/minhas-fotos");
    expect(link.getAttribute("aria-current")).toBe("page");
  });
  it("fora do layout do convidado a aba não aparece mesmo ligada", () => {
    vi.stubEnv("NEXT_PUBLIC_MM_SMART_ALBUM", "ui");
    render(<GuestTabs current="feed" />);
    expect(screen.queryByText("Minhas Fotos")).toBeNull();
  });
});
