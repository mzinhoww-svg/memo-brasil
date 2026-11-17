import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ exchange: vi.fn(), verifyOtp: vi.fn(), replace: vi.fn(), mode: "supabase" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ code: "AB23CD45" }) }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => m.mode }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ auth: { verifyOtp: m.verifyOtp } }) }));
vi.mock("@/features/whatsapp/api", () => ({ exchangeReturnToken: m.exchange }));
vi.mock("@/revela/screens/ConvidadoCarregando", () => ({ ConvidadoCarregando: () => <p>carregando</p> }));

import Page from "./page";

const TOKEN = "C".repeat(43);
beforeEach(() => {
  m.mode = "supabase";
  m.exchange.mockReset();
  m.verifyOtp.mockReset().mockResolvedValue({ error: null });
  m.replace.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, search: `?r=${TOKEN}`, replace: m.replace } });
  vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
});

describe("volta do WhatsApp", () => {
  it("sem sessão: troca o token por sessão do mesmo convidado e abre Você; o token sai da barra na hora", async () => {
    m.exchange.mockResolvedValue({ status: "ok", code: "AB23CD45", tokenHash: "hash" });
    render(<Page />);
    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/e/AB23CD45/voce?wa=1"));
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/e/AB23CD45/voltar");
    expect(m.exchange).toHaveBeenCalledWith(TOKEN);
    expect(m.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "magiclink" });
  });
  it("já com a sessão desse convidado: só volta", async () => {
    m.exchange.mockResolvedValue({ status: "ok", code: "AB23CD45", same: true });
    render(<Page />);
    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/e/AB23CD45/voce?wa=1"));
    expect(m.verifyOtp).not.toHaveBeenCalled();
  });
  it.each([["used", "Este link de volta já foi usado."], ["expired", "Este link de volta expirou."], ["invalid", "Não reconhecemos este link."]])(
    "token %s: explica e oferece 'Entrar no evento' pelo código", async (status, h) => {
      m.exchange.mockResolvedValue({ status, code: "AB23CD45", title: "Casamento" });
      render(<Page />);
      expect(await screen.findByRole("heading", { name: h })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Entrar no evento" })).toHaveAttribute("href", "/e/AB23CD45");
      expect(m.replace).not.toHaveBeenCalled();
    },
  );
  it("sem token na URL: vai para o convite", async () => {
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, search: "", replace: m.replace } });
    render(<Page />);
    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/e/AB23CD45"));
    expect(m.exchange).not.toHaveBeenCalled();
  });
});
