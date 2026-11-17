import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsappStatus } from "./api";

const api = vi.hoisted(() => ({ getWhatsappStatus: vi.fn(), requestWhatsappLink: vi.fn(), subscribeWhatsappStatus: vi.fn(), realtime: null as null | (() => void) }));
const env = vi.hoisted(() => ({ mode: "supabase" as "supabase" | "local" }));
vi.mock("@/lib/supabase/env", () => ({ backendMode: () => env.mode }));
vi.mock("./api", async () => {
  const real = await vi.importActual<typeof import("./api")>("./api");
  return { ...real, getWhatsappStatus: api.getWhatsappStatus, requestWhatsappLink: api.requestWhatsappLink, subscribeWhatsappStatus: api.subscribeWhatsappStatus };
});

import { WhatsappError } from "./api";
import { WA_COPY } from "./copy";
import { __resetWhatsappLinkCache, OPENING_MS, POLL_MS, WAIT_MS } from "./useWhatsappOptIn";
import { WhatsappOptIn } from "./WhatsappOptIn";

const st = (over: Partial<WhatsappStatus> = {}): WhatsappStatus => ({ enabled: true, eligible: true, optin: false, optinAt: null, revoked: false, ...over });
const EV = "11111111-1111-4111-8111-111111111111";
const LINK = "https://wa.me/5565999990000?text=Quero%20REV-1";
const LINK2 = "https://wa.me/5565999990000?text=Quero%20REV-2";

beforeEach(() => {
  env.mode = "supabase";
  __resetWhatsappLinkCache();
  api.getWhatsappStatus.mockReset().mockResolvedValue(st());
  api.requestWhatsappLink.mockReset().mockImplementation(async () => ({ link: LINK, validUntil: Date.now() + 13 * 60_000 }));
  api.realtime = null;
  api.subscribeWhatsappStatus.mockReset().mockImplementation((_ev: string, cb: () => void) => { api.realtime = cb; return () => { api.realtime = null; }; });
  vi.spyOn(window, "open");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const mount = (variant: "linha" | "compacta" | "passo" = "linha", extra: Partial<Parameters<typeof WhatsappOptIn>[0]> = {}) =>
  render(<WhatsappOptIn eventId={EV} variant={variant} {...extra} />);
const openLink = () => screen.findByRole("link", { name: WA_COPY.button });

describe("quando aparece", () => {
  it("modo local: não aparece nem consulta o servidor", async () => {
    env.mode = "local";
    const { container } = mount();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(api.getWhatsappStatus).not.toHaveBeenCalled();
    expect(api.requestWhatsappLink).not.toHaveBeenCalled();
  });
  it.each([[{ enabled: false }], [{ eligible: false }]])("some com %j e não gasta código", async (over) => {
    api.getWhatsappStatus.mockResolvedValue(st(over));
    const { container } = mount();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(api.requestWhatsappLink).not.toHaveBeenCalled();
  });
  it("falha ao ler o estado: some em vez de quebrar a tela", async () => {
    api.getWhatsappStatus.mockResolvedValue(null);
    const { container } = mount();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
  it("depois da revelação: não pede opt-in; quem já ativou continua vendo o estado", async () => {
    const a = mount("linha", { revealed: true });
    await act(async () => {});
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    mount("linha", { revealed: true });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
  });
});

describe("link pré-gerado (toque instantâneo)", () => {
  it("pede o código em segundo plano ao aparecer e o botão é um <a href> para o wa.me, em nova aba, sem window.open", async () => {
    mount();
    const a = await openLink();
    expect(a).toHaveAttribute("href", LINK);
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(api.requestWhatsappLink).toHaveBeenCalledWith(EV);
    fireEvent.click(a);
    expect(window.open).not.toHaveBeenCalled(); // nada de aba em branco
    expect(screen.getByRole("link", { name: WA_COPY.opening })).toBeInTheDocument();
  });
  it("enquanto o código não chega: 'Preparando o WhatsApp…' (não abre nada)", async () => {
    let resolve!: (v: { link: string; validUntil: number }) => void;
    api.requestWhatsappLink.mockImplementation(() => new Promise((r) => { resolve = r; }));
    mount();
    expect(await screen.findByTestId("wa-preparando")).toHaveTextContent(WA_COPY.preparing);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await waitFor(() => expect(api.requestWhatsappLink).toHaveBeenCalled());
    await act(async () => resolve({ link: LINK, validUntil: Date.now() + 60_000 }));
    expect(await openLink()).toHaveAttribute("href", LINK);
  });
  it("as variantes da mesma tela dividem um só código", async () => {
    render(<><WhatsappOptIn eventId={EV} variant="linha" /><WhatsappOptIn eventId={EV} variant="compacta" /></>);
    await waitFor(() => expect(screen.getAllByRole("link", { name: WA_COPY.button })).toHaveLength(2));
    expect(api.requestWhatsappLink).toHaveBeenCalledTimes(1);
  });
  it("renova o código antes de vencer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.requestWhatsappLink
      .mockImplementationOnce(async () => ({ link: LINK, validUntil: Date.now() + 5_000 }))
      .mockImplementation(async () => ({ link: LINK2, validUntil: Date.now() + 13 * 60_000 }));
    mount();
    expect(await openLink()).toHaveAttribute("href", LINK);
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    await waitFor(() => expect(screen.getByRole("link", { name: WA_COPY.button })).toHaveAttribute("href", LINK2));
  });
  it("gateway fora do ar: mensagem amigável e 'Tentar de novo' pede outro código", async () => {
    api.requestWhatsappLink.mockRejectedValueOnce(new WhatsappError("gateway"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(WA_COPY.errors.gateway);
    fireEvent.click(screen.getByRole("button", { name: WA_COPY.retry }));
    expect(await openLink()).toHaveAttribute("href", LINK);
  });
  it.each([["muitas"], ["forbidden"], ["rede"]] as const)("erro %s tem texto próprio", async (kind) => {
    api.requestWhatsappLink.mockRejectedValue(new WhatsappError(kind));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(WA_COPY.errors[kind]);
  });
});

describe("estados depois do toque", () => {
  it("'Abrindo o WhatsApp…' → 'Aguardando confirmação…' com instrução de 1 linha e reabrir com o mesmo link", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(await openLink());
    await act(async () => { await vi.advanceTimersByTimeAsync(OPENING_MS + 10); });
    expect(await screen.findByText(WA_COPY.waiting)).toBeInTheDocument();
    expect(screen.getByText(WA_COPY.waitingHelp)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: WA_COPY.reopen })).toHaveAttribute("href", LINK);
  });
  it("Realtime: vira 'Ativado ✓' assim que o webhook grava, sem esperar o polling", async () => {
    mount();
    fireEvent.click(await openLink());
    await waitFor(() => expect(api.realtime).not.toBeNull());
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    await act(async () => { api.realtime?.(); });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
    expect(api.realtime).toBeNull(); // cancelou a inscrição
  });
  it("reserva: polling a cada 3 s, só com a aba visível, e para quando ativa", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(await openLink());
    const calls = api.getWhatsappStatus.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(api.getWhatsappStatus.mock.calls.length).toBe(calls);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS + 50); });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
    const after = api.getWhatsappStatus.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(api.getWhatsappStatus.mock.calls.length).toBe(after);
  });
  it("ao voltar do WhatsApp (foco), confere na hora", async () => {
    mount();
    fireEvent.click(await openLink());
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
  });
  it("desiste depois de 15 min e volta ao botão", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    fireEvent.click(await openLink());
    await act(async () => { await vi.advanceTimersByTimeAsync(WAIT_MS + POLL_MS * 2); });
    expect(await screen.findByRole("link", { name: WA_COPY.button })).toBeInTheDocument();
  });
  it("já ativado: 'Ativado ✓' com a instrução de SAIR e sem botão nem pedido de código", async () => {
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    mount();
    expect(await screen.findByText(WA_COPY.active)).toBeInTheDocument();
    expect(screen.getByText(WA_COPY.howToStop)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: WA_COPY.button })).not.toBeInTheDocument();
    expect(api.requestWhatsappLink).not.toHaveBeenCalled();
  });
});

describe("variantes", () => {
  it("passo: título emocional, botão verde e 'Agora não' discreto; ativado oferece Continuar", async () => {
    const onSkip = vi.fn(); const onContinue = vi.fn();
    const a = mount("passo", { onSkip, onContinue });
    expect(await screen.findByRole("heading", { name: WA_COPY.stepTitle })).toBeInTheDocument();
    expect((await openLink()).className).toContain("wa-btn");
    fireEvent.click(screen.getByRole("button", { name: WA_COPY.skip }));
    expect(onSkip).toHaveBeenCalled();
    a.unmount();
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    mount("passo", { onSkip, onContinue });
    fireEvent.click(await screen.findByRole("button", { name: WA_COPY.next }));
    expect(onContinue).toHaveBeenCalled();
  });
  it("compacta: lembrete que some quando ativa", async () => {
    const a = mount("compacta");
    expect(await screen.findByTestId("wa-compacta")).toBeInTheDocument();
    a.unmount();
    api.getWhatsappStatus.mockResolvedValue(st({ optin: true }));
    const { container } = mount("compacta");
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
