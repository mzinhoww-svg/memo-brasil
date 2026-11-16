import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsappStatus } from "./api";

const api = vi.hoisted(() => ({ getWhatsappStatus: vi.fn(), requestWhatsappOptin: vi.fn() }));
const env = vi.hoisted(() => ({ mode: "supabase" as "supabase" | "local" }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => env.mode }));
vi.mock("./api", async () => {
  const real = await vi.importActual<typeof import("./api")>("./api");
  return { ...real, getWhatsappStatus: api.getWhatsappStatus, requestWhatsappOptin: api.requestWhatsappOptin };
});

import { WhatsappError } from "./api";
import { WA_COPY } from "./copy";
import { POLL_MS, WAIT_MS } from "./useWhatsappOptIn";
import { WhatsappOptIn } from "./WhatsappOptIn";

const st = (over: Partial<WhatsappStatus> = {}): WhatsappStatus => ({ enabled: true, eligible: true, optin: false, optinAt: null, revoked: false, ...over });
const EV = "11111111-1111-4111-8111-111111111111";
const LINK = "https://wa.me/5565999990000?text=Quero%20REV-1";
let popup: { closed: boolean; opener: unknown; location: { href: string }; close: () => void };

beforeEach(() => {
  env.mode = "supabase";
  api.getWhatsappStatus.mockReset().mockResolvedValue(st());
  api.requestWhatsappOptin.mockReset().mockResolvedValue(LINK);
  popup = { closed: false, opener: {}, location: { href: "" }, close: vi.fn(() => { popup.closed = true; }) };
  vi.spyOn(window, "open").mockImplementation(() => popup as unknown as Window);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const mount = (variant: "cartao" | "compacta" | "passo" = "cartao", extra: Partial<Parameters<typeof WhatsappOptIn>[0]> = {}) =>
  render(<WhatsappOptIn eventId={EV} variant={variant} {...extra} />);

describe("quando aparece", () => {
  it("modo local: não aparece nem consulta o servidor", async () => {
    env.mode = "local";
    const { container } = mount();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(api.getWhatsappStatus).not.toHaveBeenCalled();
  });
  it.each([[{ enabled: false }], [{ eligible: false }]])("some com %j", async (over) => {
    api.getWhatsappStatus.mockResolvedValue(st(over));
    const { container } = mount();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
  it("falha ao ler o estado: some em vez de quebrar a tela", async () => {
    api.getWhatsappStatus.mockResolvedValue(null);
    const { container } = mount();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
  it("depois da revelação: não pede opt-in; quem já ativou continua vendo o estado no cartão", async () => {
    const a = mount("cartao", { revealed: true });
    await act(async () => {});
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    mount("cartao", { revealed: true });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
  });
});

describe("estados do botão", () => {
  it("mostra o botão e o texto de privacidade", async () => {
    mount();
    expect(await screen.findByRole("button", { name: WA_COPY.button })).toBeInTheDocument();
    expect(screen.getByText("Só avisos deste evento. Para sair, envie SAIR a qualquer momento.")).toBeInTheDocument();
  });
  it("ao tocar: abre a aba no toque, pede código novo, leva ao wa.me e passa a 'Aguardando confirmação…'", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(popup.opener).toBeNull();
    await screen.findByText(WA_COPY.waiting);
    expect(api.requestWhatsappOptin).toHaveBeenCalledWith(EV);
    expect(popup.location.href).toBe(LINK);
  });
  it("popup bloqueado: oferece o link para abrir à mão", async () => {
    (window.open as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => null);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    const a = await screen.findByRole("link", { name: WA_COPY.fallbackLink });
    expect(a).toHaveAttribute("href", LINK);
    expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
  it("reabrir pede OUTRO código (o anterior é de uso único)", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.reopen }));
    await waitFor(() => expect(api.requestWhatsappOptin).toHaveBeenCalledTimes(2));
  });
  it("gateway fora do ar: mensagem amigável, fecha a aba em branco e o botão continua disponível", async () => {
    api.requestWhatsappOptin.mockRejectedValue(new WhatsappError("gateway"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    expect(await screen.findByRole("alert")).toHaveTextContent(WA_COPY.errors.gateway);
    expect(popup.close).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: WA_COPY.button })).toBeEnabled();
  });
  it.each([["muitas"], ["forbidden"], ["rede"]] as const)("erro %s tem texto próprio", async (kind) => {
    api.requestWhatsappOptin.mockRejectedValue(new WhatsappError(kind));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    expect(await screen.findByRole("alert")).toHaveTextContent(WA_COPY.errors[kind]);
  });
  it("já ativado: 'Ativado ✓' com a instrução de mandar SAIR, sem botão de pedir de novo", async () => {
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    mount();
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
    expect(screen.getByText(WA_COPY.howToStop)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: WA_COPY.button })).not.toBeInTheDocument();
  });
});

describe("tempo real", () => {
  it("polling a cada ~4 s vira 'Ativado ✓' quando o webhook chega; só com a aba visível", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    await screen.findByText(WA_COPY.waiting);
    const calls = api.getWhatsappStatus.mock.calls.length;

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(api.getWhatsappStatus.mock.calls.length).toBe(calls); // aba escondida: não consulta

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS + 50); });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
    const after = api.getWhatsappStatus.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(api.getWhatsappStatus.mock.calls.length).toBe(after); // parou de consultar
  });
  it("revalida ao voltar o foco", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    await screen.findByText(WA_COPY.waiting);
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
  });
  it("desiste depois de 15 min e volta ao botão", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.button }));
    await screen.findByText(WA_COPY.waiting);
    await act(async () => { await vi.advanceTimersByTimeAsync(WAIT_MS + POLL_MS * 2); });
    expect(await screen.findByRole("button", { name: WA_COPY.button })).toBeInTheDocument();
  });
});

describe("variantes", () => {
  it("passo: pulável ('Agora não') e, ativado, oferece Continuar", async () => {
    const onSkip = vi.fn(); const onContinue = vi.fn();
    const a = mount("passo", { onSkip, onContinue });
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.skip }));
    expect(onSkip).toHaveBeenCalled();
    a.unmount();
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    mount("passo", { onSkip, onContinue });
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.next }));
    expect(onContinue).toHaveBeenCalled();
  });
  it("compacta: lembrete discreto que some quando ativa", async () => {
    const a = mount("compacta");
    expect(await screen.findByTestId("wa-compacta")).toBeInTheDocument();
    a.unmount();
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    const { container } = mount("compacta");
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
