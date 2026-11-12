import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuestProvider, type GuestCtx } from "@/features/events/guest-context";
import { HostBar } from "@/features/feed/HostBar";
import { GuestTabs } from "./GuestTabs";
import { ConvidadoVoce } from "./screens/ConvidadoVoce";

const ctx = (isHost: boolean) => ({ event: { id: "ev1", code: "ABC123" }, isHost, viewer: { id: "u", host: isHost } }) as unknown as GuestCtx;
const wrap = (isHost: boolean, ui: React.ReactNode) => render(<GuestProvider value={ctx(isHost)}>{ui}</GuestProvider>);

describe("anfitrião dentro da área do convidado", () => {
  it("o convidado vê só Feed, Minhas e Você", () => {
    wrap(false, <GuestTabs code="ABC123" current="feed" />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Feed", "Minhas", "Você"]);
  });
  it("o anfitrião ganha a aba Painel, que leva ao painel do evento", () => {
    wrap(true, <GuestTabs code="ABC123" current="feed" />);
    const painel = screen.getByRole("link", { name: "Painel do evento" });
    expect(painel.getAttribute("href")).toBe("/painel/ev1");
  });
  it("fora do layout do convidado (telas de desenho) não quebra e não mostra Painel", () => {
    render(<GuestTabs current="voce" />);
    expect(screen.queryByText("Painel")).toBeNull();
  });
  it("faixa do Feed: só para o anfitrião, com o caminho de volta", () => {
    const a = wrap(false, <HostBar />);
    expect(a.container.textContent).toBe("");
    a.unmount();
    wrap(true, <HostBar />);
    expect(screen.getByRole("link", { name: "Voltar ao painel" }).getAttribute("href")).toBe("/painel/ev1");
  });
  it("Você: o anfitrião vê 'Voltar ao painel do evento' e 'Meus eventos'; o convidado não", () => {
    const a = wrap(false, <ConvidadoVoce code="ABC123" />);
    expect(screen.queryByTestId("voce-painel")).toBeNull();
    a.unmount();
    wrap(true, <ConvidadoVoce code="ABC123" />);
    expect(screen.getByTestId("voce-painel").getAttribute("href")).toBe("/painel/ev1");
    expect(screen.getByTestId("voce-eventos").getAttribute("href")).toBe("/eventos");
  });
});
