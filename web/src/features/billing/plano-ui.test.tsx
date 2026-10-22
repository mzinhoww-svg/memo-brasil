import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({
  orderStatus: vi.fn(), quote: vi.fn(), redeemCode: vi.fn(), startCheckout: vi.fn(), openOrder: vi.fn(), listPublicPlans: vi.fn(), getPublicSettings: vi.fn(),
}));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), ...api }));
vi.mock("./entitlement", () => ({ currentPlanCode: vi.fn(async () => "gratis") }));
vi.mock("@/features/admin/context", () => ({ useAdmin: () => ({ event: { id: "ev1", title: "Ana & Rui" }, refresh: vi.fn() }) }));

import { BillingError, ProviderUnavailableError } from "./api";
import PlanoPage from "@/app/painel/[id]/plano/page";
import { PixCheckout, ProviderDown } from "./PixCheckout";
import { PlanPicker } from "./PlanPicker";
import { RedeemCode } from "./RedeemCode";
import { TrustBlock } from "./TrustBlock";
import type { OrderView, PublicPlan, PublicSettings } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const SETTINGS: PublicSettings = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const ORDER: OrderView = { orderId: "7f3a21c9-0000-4000-8000-000000000000", status: "pendente", planCode: "casamento", amountCents: 18900, brCode: "00020126PIX", brCodeBase64: "data:image/png;base64,AAA", expiresAt: new Date(Date.now() + 29 * 60_000 + 41_000).toISOString() };

beforeEach(() => { sessionStorage.clear(); Object.values(api).forEach((m) => m.mockReset()); });
afterEach(() => { vi.useRealTimers(); });

describe("TrustBlock", () => {
  it("Casamento: 250 olhares por R$ 0,76 cada e folga vinda do servidor", () => {
    render(<TrustBlock plan={PLANS[3]} gracePct={15} />);
    expect(screen.getByText("250 olhares por R$ 0,76 cada.")).toBeInTheDocument();
    expect(screen.getByText("Ninguém é barrado na festa: 15% de folga e aviso antes de lotar.")).toBeInTheDocument();
    expect(screen.getByText("Pix único, sem assinatura. Se expirar, nada é cobrado.")).toBeInTheDocument();
  });
  it("Grátis não mostra título", () => {
    render(<TrustBlock plan={PLANS[0]} />);
    expect(screen.queryByText(/olhares/)).toBeNull();
  });
});

describe("PlanPicker", () => {
  const base = { eventId: "ev1", settings: SETTINGS, busy: false, onPay: vi.fn(), onRedeemed: vi.fn() };
  it("B1: marca Seu plano, desabilita incluídos, preço do servidor no CTA (valor da quote)", async () => {
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: null, amountCents: 18900, payable: true, reason: "ok" });
    render(<PlanPicker {...base} plans={PLANS} currentCode="gratis" />);
    expect(screen.getByText("Seu plano")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Até 10 ·/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Casamento/ })).toBeChecked();
    expect(await screen.findByRole("button", { name: "Pagar R$ 189,00 no Pix" })).toBeEnabled();
    expect(screen.getByText("Tenho um código")).toBeInTheDocument();
  });
  it("upgrade: cobra o valor da quote (diferença), não o preço cheio", async () => {
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: "festa", amountCents: 16000, payable: true, reason: "ok" });
    render(<PlanPicker {...base} plans={PLANS} currentCode="festa" />);
    expect(await screen.findByRole("button", { name: "Pagar R$ 160,00 no Pix" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Festa/ })).toBeDisabled();
    expect(screen.getAllByText("Incluído").length).toBe(0 + 1); // só o plano abaixo do atual (Grátis)
  });
  it("quote não pagável bloqueia o CTA com o motivo", async () => {
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: null, amountCents: 0, payable: false, reason: "evento_encerrado" });
    render(<PlanPicker {...base} plans={PLANS} currentCode="gratis" />);
    expect(await screen.findByText("Este evento já terminou. Não dá para mudar o plano.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar/ })).toBeDisabled();
  });
  it("B7: só o Grátis -> Evento maior? com e-mail de suporte e cartão de código", () => {
    render(<PlanPicker {...base} plans={[PLANS[0]]} currentCode="gratis" settings={{ ...SETTINGS, paymentsEnv: "desligado" }} />);
    expect(screen.getByRole("heading", { name: "Evento maior?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Falar com a gente" })).toHaveAttribute("href", expect.stringContaining("mailto:oi@memoriesmt.test"));
    expect(screen.getByTestId("cartao-codigo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pagar/ })).toBeNull();
  });
  it("B7 sem e-mail de suporte: sem botão de contato", () => {
    render(<PlanPicker {...base} plans={[PLANS[0]]} currentCode="gratis" settings={{ ...SETTINGS, supportEmail: null }} />);
    expect(screen.queryByRole("link", { name: "Falar com a gente" })).toBeNull();
  });
  it("escolher e pagar chama onPay com o plano", async () => {
    api.quote.mockResolvedValue({ planCode: "festa", fromPlanCode: null, amountCents: 2900, payable: true, reason: "ok" });
    const onPay = vi.fn();
    render(<PlanPicker {...base} onPay={onPay} plans={PLANS} currentCode="gratis" />);
    await userEvent.click(screen.getByRole("radio", { name: /Festa/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Pagar R$ 29,00 no Pix" }));
    expect(onPay).toHaveBeenCalledWith("festa");
  });
});

describe("RedeemCode (B8)", () => {
  const setup = () => { const onApplied = vi.fn(); render(<RedeemCode eventId="ev1" onApplied={onApplied} />); return onApplied; };
  it("normaliza o código antes de enviar (maiúsculas, sem espaços)", async () => {
    api.redeemCode.mockResolvedValue({ applied: true, planCode: "casamento", reason: "ok" });
    const onApplied = setup();
    await userEvent.type(screen.getByLabelText("Código"), " mmt 7kq4-xr2p ");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(api.redeemCode).toHaveBeenCalledWith("ev1", expect.stringMatching(/MMT/));
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({ code: "MMT-7KQ4-XR2P", planCode: "casamento" })));
  });
  it.each([
    ["invalido", "Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo."],
    ["muitas_tentativas", "Muitas tentativas. Tente de novo em 10 minutos."],
    ["ja_incluido", "Seu evento já tem este plano ou um maior. O código continua livre para outra festa."],
  ] as const)("recusa %s mostra a mensagem do plano", async (reason, text) => {
    api.redeemCode.mockResolvedValue({ applied: false, planCode: null, reason });
    const onApplied = setup();
    await userEvent.type(screen.getByLabelText("Código"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
  });
  it("falha técnica não vira 'código inválido'", async () => {
    api.redeemCode.mockRejectedValue(new BillingError("MM014", 503));
    setup();
    await userEvent.type(screen.getByLabelText("Código"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(/Não foi possível aplicar o código agora/)).toBeInTheDocument();
  });
});

describe("PixCheckout", () => {
  const props = { plans: PLANS, eventId: "ev1", onOrder: vi.fn(), onNewPix: vi.fn(), onChoosePlan: vi.fn() };
  it("B2: QR com alt do valor, contagem e status em aria-live", () => {
    vi.useFakeTimers(); // relógio fixo: a contagem não depende da carga da máquina entre o fixture e o render
    try {
      vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
      const order = { ...ORDER, expiresAt: new Date(Date.now() + 29 * 60_000 + 41_000).toISOString() };
      render(<PixCheckout {...props} order={order} />);
      expect(screen.getByAltText("QR Code Pix de R$ 189,00")).toBeInTheDocument();
      expect(screen.getByText("29:41")).toBeInTheDocument();
      const status = screen.getByText("Aguardando pagamento…").closest("[aria-live]");
      expect(status).toHaveAttribute("aria-live", "polite");
    } finally {
      vi.useRealTimers();
    }
  });
  it("copiar mostra feedback real; falha mostra instrução e campo para copiar à mão", async () => {
    const user = userEvent.setup();
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: write } });
    render(<PixCheckout {...props} order={ORDER} />);
    await user.click(screen.getByRole("button", { name: "Copiar código Pix" }));
    expect(write).toHaveBeenCalledWith("00020126PIX");
    expect(await screen.findByText("Código copiado.")).toBeInTheDocument();
    write.mockRejectedValue(new Error("negado"));
    document.execCommand = vi.fn(() => false);
    await user.click(screen.getByRole("button", { name: "Copiar código Pix" }));
    expect(await screen.findByText(/Não deu para copiar/)).toBeInTheDocument();
  });
  it("polling: a cada 3 s com a aba visível; pausa em segundo plano; retoma no visibilitychange", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    api.orderStatus.mockResolvedValue({ ...ORDER });
    const vis = vi.spyOn(document, "visibilityState", "get");
    vis.mockReturnValue("visible");
    render(<PixCheckout {...props} order={ORDER} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(api.orderStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(api.orderStatus).toHaveBeenCalledTimes(2);
    vis.mockReturnValue("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(api.orderStatus).toHaveBeenCalledTimes(2);
    vis.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(api.orderStatus).toHaveBeenCalledTimes(3);
    vis.mockRestore();
  });
  it("pago pelo polling vira B3 sem recarregar", async () => {
    vi.useFakeTimers();
    const paid = { ...ORDER, status: "pago" as const, paidAt: "2026-10-22T17:32:00Z" };
    api.orderStatus.mockResolvedValue(paid);
    const Wrap = () => { const [o, setO] = useState<OrderView>(ORDER); return <PixCheckout {...props} order={o} onOrder={setO} />; };
    render(<Wrap />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole("heading", { name: "Plano Casamento ativo." })).toBeInTheDocument();
    expect(screen.getByText("Até 250 convidados e 36 fotos cada. Já vale para quem entrar agora.")).toBeInTheDocument();
    expect(screen.getByText("R$ 189,00 · Pix")).toBeInTheDocument();
    expect(screen.getByText("#7F3A-21C9")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/painel/ev1");
    expect(screen.getByRole("link", { name: "Imprimir os cards das mesas" })).toBeInTheDocument();
  });
  it("B4: vencido localmente mostra Este Pix expirou, sem QR, e reconsulta uma vez", async () => {
    api.orderStatus.mockResolvedValue({ ...ORDER, status: "expirado" });
    render(<PixCheckout {...props} order={{ ...ORDER, expiresAt: new Date(Date.now() - 1000).toISOString() }} />);
    expect(screen.getByRole("heading", { name: "Este Pix expirou." })).toBeInTheDocument();
    expect(screen.getByText("Nada foi cobrado. Gere um código novo quando quiser; ele vale por 30 minutos.")).toBeInTheDocument();
    expect(screen.getByText(/Não pague de novo/)).toBeInTheDocument();
    expect(screen.queryByAltText(/QR Code/)).toBeNull();
    await waitFor(() => expect(api.orderStatus).toHaveBeenCalledTimes(1));
  });
  it("B4: Gerar novo Pix e Escolher outro plano chamam os callbacks", async () => {
    const onNewPix = vi.fn(), onChoosePlan = vi.fn();
    render(<PixCheckout {...props} onNewPix={onNewPix} onChoosePlan={onChoosePlan} order={{ ...ORDER, status: "expirado" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Gerar novo Pix" }));
    await userEvent.click(screen.getByRole("button", { name: "Escolher outro plano" }));
    expect(onNewPix).toHaveBeenCalled(); expect(onChoosePlan).toHaveBeenCalled();
  });
  it.each(["falhou", "cancelado"] as const)("B5 (%s): texto do plano e Tentar de novo", (status) => {
    render(<PixCheckout {...props} order={{ ...ORDER, status }} />);
    expect(screen.getByRole("heading", { name: "Não conseguimos gerar o Pix." })).toBeInTheDocument();
    expect(screen.getByText("Nada foi cobrado. Tente de novo em instantes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
  it("estornado e em_disputa têm os textos do plano", () => {
    const { unmount } = render(<PixCheckout {...props} order={{ ...ORDER, status: "estornado" }} />);
    expect(screen.getByRole("heading", { name: "Pagamento devolvido." })).toBeInTheDocument();
    unmount();
    render(<PixCheckout {...props} order={{ ...ORDER, status: "em_disputa" }} />);
    expect(screen.getByRole("heading", { name: "Pagamento em análise." })).toBeInTheDocument();
    expect(screen.getByText("Seus convidados continuam usando o evento.")).toBeInTheDocument();
  });
  it("aviso de pedido de outro plano (MM013) aparece sobre o Pix existente", () => {
    render(<PixCheckout {...props} order={{ ...ORDER, planCode: "festa", amountCents: 2900 }} warning="Você já tem um Pix aberto do plano Festa. Pague esse ou deixe expirar antes de escolher outro plano." />);
    expect(screen.getByTestId("aviso-outro-plano")).toHaveTextContent("plano Festa");
    expect(screen.getByAltText("QR Code Pix de R$ 29,00")).toBeInTheDocument();
  });
});

describe("ProviderDown (B6)", () => {
  it("botão só libera depois de 60 s", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(<ProviderDown planName="Casamento" amountLabel="R$ 189,00" onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: "Tentar de novo em 1:00" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(screen.getByRole("button", { name: "Tentar de novo em 0:48" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(48_000); });
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
  });
});

describe("página /painel/[id]/plano", () => {
  const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 10)); }); };
  beforeEach(() => {
    api.listPublicPlans.mockResolvedValue(PLANS);
    api.getPublicSettings.mockResolvedValue(SETTINGS);
    api.openOrder.mockResolvedValue(null);
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: null, amountCents: 18900, payable: true, reason: "ok" });
  });
  it("restaura o pedido aberto ao abrir (sem criar outro)", async () => {
    api.openOrder.mockResolvedValue(ORDER);
    render(<PlanoPage />);
    expect(await screen.findByTestId("pix-pendente")).toBeInTheDocument();
    expect(api.startCheckout).not.toHaveBeenCalled();
  });
  it("clique duplo em Pagar gera um único pedido, com a mesma idempotencyKey", async () => {
    let resolve!: (o: OrderView) => void;
    api.startCheckout.mockReturnValue(new Promise<OrderView>((r) => { resolve = r; }));
    render(<PlanoPage />);
    const btn = await screen.findByRole("button", { name: "Pagar R$ 189,00 no Pix" });
    await userEvent.dblClick(btn);
    expect(api.startCheckout).toHaveBeenCalledTimes(1);
    expect(api.startCheckout).toHaveBeenCalledWith("ev1", "casamento", expect.stringMatching(/^[0-9a-f-]{36}$/));
    await act(async () => { resolve(ORDER); });
    expect(await screen.findByTestId("pix-pendente")).toBeInTheDocument();
    expect(screen.queryByTestId("aviso-outro-plano")).toBeNull();
  });
  it("409 pedido_aberto de OUTRO plano: mostra o pedido existente com aviso MM013", async () => {
    api.startCheckout.mockResolvedValue({ ...ORDER, planCode: "festa", amountCents: 2900 });
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar R$ 189,00 no Pix" }));
    expect(await screen.findByTestId("aviso-outro-plano")).toHaveTextContent("Você já tem um Pix aberto do plano Festa.");
    expect(screen.getByAltText("QR Code Pix de R$ 29,00")).toBeInTheDocument();
  });
  it("502: B6 com botão travado; nenhum pedido novo aparece", async () => {
    api.startCheckout.mockRejectedValue(new ProviderUnavailableError("o9"));
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar R$ 189,00 no Pix" }));
    expect(await screen.findByTestId("provedor-fora")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo em/ })).toBeDisabled();
  });
  it("erro de negócio vira mensagem de recuperação, sem código técnico", async () => {
    api.startCheckout.mockRejectedValue(new BillingError("ja_incluido", 422));
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar R$ 189,00 no Pix" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seu evento já tem este plano ou um maior.");
  });
  it("Gerar novo Pix usa chave nova (nova intenção de compra)", async () => {
    api.openOrder.mockResolvedValue({ ...ORDER, status: "expirado" });
    api.startCheckout.mockResolvedValue(ORDER);
    render(<PlanoPage />);
    await settle();
    sessionStorage.setItem("mm-idem:ev1:casamento", "chave-velha");
    await userEvent.click(await screen.findByRole("button", { name: "Gerar novo Pix" }));
    expect(api.startCheckout.mock.calls[0][2]).not.toBe("chave-velha");
  });
  it("código aplicado mostra B9", async () => {
    api.redeemCode.mockResolvedValue({ applied: true, planCode: "casamento", reason: "ok" });
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Tenho um código" }));
    await userEvent.type(screen.getByLabelText("Código"), "mmt7kq4xr2p");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByRole("heading", { name: "Plano Casamento liberado." })).toBeInTheDocument();
    expect(screen.getByText("Até 250 convidados e 36 fotos cada, sem pagar nada. Presente de MemoriesMT.")).toBeInTheDocument();
    expect(screen.getByText("MMT-7KQ4-XR2P")).toBeInTheDocument();
    expect(screen.getByText("Ana & Rui · este evento")).toBeInTheDocument();
  });
});
