import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getHostWhatsappStatus: vi.fn(), requestHostWhatsappLink: vi.fn(), subscribeHostWhatsapp: vi.fn(() => () => undefined) }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), ...api }));
import { HostWhatsappOptIn } from "./HostWhatsappOptIn";
import { HostWhatsappError } from "./api";

beforeEach(() => { Object.values(api).forEach((m) => m.mockReset()); api.subscribeHostWhatsapp.mockReturnValue(() => undefined); });

describe("HostWhatsappOptIn (avisos do evento e do pagamento para o anfitrião)", () => {
  it("recurso desligado ou fora da nuvem: não aparece", async () => {
    api.getHostWhatsappStatus.mockResolvedValue(null);
    const { container } = render(<HostWhatsappOptIn />);
    await waitFor(() => expect(api.getHostWhatsappStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it("sem opt-in: explica o que vai receber, e só gera o link ao tocar (opt-in explícito)", async () => {
    api.getHostWhatsappStatus.mockResolvedValue({ enabled: true, optin: false });
    api.requestHostWhatsappLink.mockResolvedValue("https://wa.me/5565000000000?text=c");
    render(<HostWhatsappOptIn />);
    expect(await screen.findByText(/lembretes do seu evento e do pagamento/)).toBeInTheDocument();
    expect(screen.getByText(/SAIR/)).toBeInTheDocument();
    expect(api.requestHostWhatsappLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Receber avisos no WhatsApp" }));
    expect(await screen.findByRole("link", { name: /Abrir o WhatsApp/ })).toHaveAttribute("href", "https://wa.me/5565000000000?text=c");
  });
  it("já ativado: mostra o estado e como sair, sem botão", async () => {
    api.getHostWhatsappStatus.mockResolvedValue({ enabled: true, optin: true });
    render(<HostWhatsappOptIn />);
    expect(await screen.findByText(/Avisos no WhatsApp ativados/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("erro do gateway: mensagem e tentar de novo", async () => {
    api.getHostWhatsappStatus.mockResolvedValue({ enabled: true, optin: false });
    api.requestHostWhatsappLink.mockRejectedValue(new HostWhatsappError("gateway"));
    render(<HostWhatsappOptIn />);
    fireEvent.click(await screen.findByRole("button", { name: "Receber avisos no WhatsApp" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/WhatsApp não respondeu/);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
  it("na criação do evento: pergunta opcional com SAIR, e 'Agora não' esconde", async () => {
    api.getHostWhatsappStatus.mockResolvedValue({ enabled: true, optin: false });
    render(<HostWhatsappOptIn variant="criacao" />);
    expect(await screen.findByRole("heading", { name: "Quer receber no WhatsApp os lembretes do seu evento?" })).toBeInTheDocument();
    expect(screen.getByText(/Responda SAIR quando quiser/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim, quero receber no WhatsApp" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("heading", { name: /lembretes do seu evento/ })).toBeNull();
    expect(api.requestHostWhatsappLink).not.toHaveBeenCalled();
  });
});
