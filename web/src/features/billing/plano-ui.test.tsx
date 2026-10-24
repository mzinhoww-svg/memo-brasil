import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({
  orderStatus: vi.fn(), quote: vi.fn(), redeemCode: vi.fn(), startCheckout: vi.fn(), openOrder: vi.fn(), listPublicPlans: vi.fn(), getPublicSettings: vi.fn(),
}));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), ...api }));
const nav = vi.hoisted(() => ({ goToCheckout: vi.fn() }));
vi.mock("./checkout-nav", async (orig) => ({ ...(await orig<typeof import("./checkout-nav")>()), goToCheckout: nav.goToCheckout }));
vi.mock("./entitlement", () => ({ currentPlanCode: vi.fn(async () => "gratis") }));
vi.mock("@/features/admin/context", () => ({ useAdmin: () => ({ event: { id: "ev1", title: "Ana & Rui" }, refresh: vi.fn() }) }));

import { BillingError, BillingUnavailableError, ProviderUnavailableError } from "./api";
import PlanoPage from "@/app/painel/[id]/plano/page";
import { CheckoutPending, ProviderDown } from "./CheckoutPending";
import { PlanPicker } from "./PlanPicker";
import { RedeemCode } from "./RedeemCode";
import { TrustBlock } from "./TrustBlock";
import type { OrderView, PublicPlan, PublicSettings } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const SETTINGS: PublicSettings = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const MP_URL = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123-abc";
const ORDER: OrderView = { orderId: "7f3a21c9-0000-4000-8000-000000000000", status: "pendente", planCode: "casamento", amountCents: 18900, checkoutUrl: MP_URL, provider: "mercadopago", expiresAt: new Date(Date.now() + 29 * 60_000 + 41_000).toISOString() };

beforeEach(() => { sessionStorage.clear(); Object.values(api).forEach((m) => m.mockReset()); nav.goToCheckout.mockReset(); window.history.replaceState(null, "", "/painel/ev1/plano"); });
afterEach(() => { vi.useRealTimers(); });

describe("TrustBlock", () => {
  it("Casamento: 250 olhares por R$ 0,76 cada e folga vinda do servidor", () => {
    render(<TrustBlock plan={PLANS[3]} gracePct={15} />);
    expect(screen.getByText("250 olhares por R$ 0,76 cada.")).toBeInTheDocument();
    expect(screen.getByText("Ninguém é barrado na festa: 15% de folga e aviso antes de lotar.")).toBeInTheDocument();
    expect(screen.getByText("Pagamento único, sem assinatura. Cartão ou Pix, conforme disponível no Mercado Pago. Se expirar, nada é cobrado.")).toBeInTheDocument();
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
    expect(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" })).toBeEnabled();
    expect(screen.getByText("Tenho um código")).toBeInTheDocument();
  });
  it("upgrade: cobra o valor da quote (diferença), não o preço cheio", async () => {
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: "festa", amountCents: 16000, payable: true, reason: "ok" });
    render(<PlanPicker {...base} plans={PLANS} currentCode="festa" />);
    expect(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 160,00" })).toBeInTheDocument();
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
  it("B7 sem e-mail de suporte cadastrado: o texto 'fale com a gente' usa o canal oficial (nunca fica sem saída)", () => {
    render(<PlanPicker {...base} plans={[PLANS[0]]} currentCode="gratis" settings={{ ...SETTINGS, supportEmail: null, paymentsEnv: "desligado" }} />);
    expect(screen.getByRole("link", { name: "Falar com a gente" })).toHaveAttribute("href", expect.stringContaining("mailto:mazinhoww@gmail.com"));
  });
  it("resumo do pedido antes de continuar: plano, total e pagamento único", async () => {
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: null, amountCents: 18900, payable: true, reason: "ok" });
    render(<PlanPicker {...base} plans={PLANS} currentCode="gratis" />);
    const resumo = await screen.findByTestId("resumo-pedido");
    expect(resumo).toHaveTextContent("Casamento");
    expect(resumo).toHaveTextContent("R$ 189,00");
    expect(resumo).toHaveTextContent("Pagamento único");
    expect(resumo).toHaveTextContent("sem assinatura");
  });
  it("enquanto abre o Mercado Pago: botão desabilitado, aria-busy e rótulo de carregamento", async () => {
    api.quote.mockResolvedValue({ planCode: "casamento", fromPlanCode: null, amountCents: 18900, payable: true, reason: "ok" });
    render(<PlanPicker {...base} busy plans={PLANS} currentCode="gratis" />);
    const btn = await screen.findByRole("button", { name: /Abrindo o Mercado Pago/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });
  it("escolher e pagar chama onPay com o plano", async () => {
    api.quote.mockResolvedValue({ planCode: "festa", fromPlanCode: null, amountCents: 2900, payable: true, reason: "ok" });
    const onPay = vi.fn();
    render(<PlanPicker {...base} onPay={onPay} plans={PLANS} currentCode="gratis" />);
    await userEvent.click(screen.getByRole("radio", { name: /Festa/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 29,00" }));
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

describe("CheckoutPending", () => {
  const props = { plans: PLANS, eventId: "ev1", onOrder: vi.fn(), onNewCheckout: vi.fn(), onChoosePlan: vi.fn() };
  it("B2: Pagamento em andamento, link para o Mercado Pago com o checkoutUrl do pedido, contagem e status em aria-live", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
      const order = { ...ORDER, expiresAt: new Date(Date.now() + 29 * 60_000 + 41_000).toISOString() };
      render(<CheckoutPending {...props} order={order} />);
      expect(screen.getByRole("heading", { name: "Pagamento em andamento" })).toBeInTheDocument();
      const link = screen.getByRole("link", { name: "Continuar para o Mercado Pago" });
      expect(link).toHaveAttribute("href", MP_URL);
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(screen.getByText("29:41")).toBeInTheDocument();
      expect(screen.getByText("Aguardando a confirmação do pagamento…").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
      expect(screen.queryByAltText(/QR Code/)).toBeNull();
      expect(screen.queryByRole("button", { name: /Copiar código Pix/ })).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it("pedido pendente sem checkoutUrl (histórico AbacatePay) não oferece o link e explica", () => {
    const { checkoutUrl: _c, ...rest } = ORDER; void _c;
    render(<CheckoutPending {...props} order={{ ...rest, provider: "abacatepay" }} />);
    expect(screen.queryByRole("link", { name: "Continuar para o Mercado Pago" })).toBeNull();
    expect(screen.getByText(/criado antes da troca de provedor/)).toBeInTheDocument();
  });
  it("polling: a cada 5 s com a aba visível; pausa em segundo plano; retoma no visibilitychange", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    api.orderStatus.mockResolvedValue({ ...ORDER });
    const vis = vi.spyOn(document, "visibilityState", "get");
    vis.mockReturnValue("visible");
    render(<CheckoutPending {...props} order={ORDER} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(4900); });
    expect(api.orderStatus).toHaveBeenCalledTimes(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(api.orderStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(api.orderStatus).toHaveBeenCalledTimes(2);
    vis.mockReturnValue("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(api.orderStatus).toHaveBeenCalledTimes(2);
    vis.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(api.orderStatus).toHaveBeenCalledTimes(3);
    vis.mockRestore();
  });
  it("rede: 3 consultas seguidas falhando mostram aviso e 'Atualizar' consulta na hora; some quando responde", async () => {
    vi.useFakeTimers();
    api.orderStatus.mockRejectedValue(new Error("rede"));
    render(<CheckoutPending {...props} order={ORDER} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100); });
    expect(api.orderStatus).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("sem-conexao")).toBeInTheDocument();
    api.orderStatus.mockResolvedValue({ ...ORDER });
    await act(async () => { screen.getByRole("button", { name: "Atualizar" }).click(); await vi.advanceTimersByTimeAsync(10); });
    expect(api.orderStatus).toHaveBeenCalledTimes(4);
    expect(screen.queryByTestId("sem-conexao")).toBeNull();
  });
  it("pendente do Mercado Pago ainda sem link: oferece 'Atualizar' (nunca só texto)", async () => {
    const { checkoutUrl: _c, ...rest } = ORDER; void _c;
    render(<CheckoutPending {...props} order={{ ...rest, provider: "mercadopago" }} />);
    expect(screen.getByText(/preparando o link de pagamento/)).toBeInTheDocument();
    api.orderStatus.mockResolvedValue({ ...ORDER });
    await userEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(api.orderStatus).toHaveBeenCalledTimes(1);
  });
  it("voltar do Mercado Pago pelo histórico (pageshow do bfcache) consulta o status na hora", async () => {
    api.orderStatus.mockResolvedValue({ ...ORDER });
    render(<CheckoutPending {...props} order={ORDER} />);
    await act(async () => { window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })); });
    expect(api.orderStatus).toHaveBeenCalledTimes(1);
  });
  it("pago pelo polling vira B3 sem recarregar e para de consultar", async () => {
    vi.useFakeTimers();
    const paid = { ...ORDER, status: "pago" as const, paidAt: "2026-10-22T17:32:00Z", paymentMethod: "pix" };
    api.orderStatus.mockResolvedValue(paid);
    const Wrap = () => { const [o, setO] = useState<OrderView>(ORDER); return <CheckoutPending {...props} order={o} onOrder={setO} />; };
    render(<Wrap />);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByRole("heading", { name: "Plano Casamento ativo." })).toBeInTheDocument();
    expect(screen.getByText("Até 250 convidados e 36 fotos cada. Já vale para quem entrar agora.")).toBeInTheDocument();
    expect(screen.getByText("R$ 189,00 · Pix")).toBeInTheDocument();
    expect(screen.getByText("#7F3A-21C9")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/painel/ev1");
    expect(screen.getByRole("link", { name: "Imprimir os cards das mesas" })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(api.orderStatus).toHaveBeenCalledTimes(1);
  });
  it.each([["card", "R$ 189,00 · Cartão"], ["pix", "R$ 189,00 · Pix"], [undefined, "R$ 189,00 · Mercado Pago"], ["boleto_novo", "R$ 189,00 · Mercado Pago"]])("comprovante rotula a forma de pagamento %s", (paymentMethod, text) => {
    render(<CheckoutPending {...props} order={{ ...ORDER, status: "pago", paidAt: "2026-10-22T17:32:00Z", paymentMethod }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
  it("B4: vencido localmente mostra expirado, sem link de pagamento, reconsulta uma vez e diz para não pagar de novo", async () => {
    api.orderStatus.mockResolvedValue({ ...ORDER, status: "expirado" });
    render(<CheckoutPending {...props} order={{ ...ORDER, expiresAt: new Date(Date.now() - 1000).toISOString() }} />);
    expect(screen.getByRole("heading", { name: "Este pagamento expirou." })).toBeInTheDocument();
    expect(screen.getByText(/Nada foi cobrado/)).toBeInTheDocument();
    expect(screen.getByText("Pagou agora há pouco? O plano libera sozinho. Não pague de novo.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continuar para o Mercado Pago" })).toBeNull();
    await waitFor(() => expect(api.orderStatus).toHaveBeenCalledTimes(1));
  });
  it("B4: expirado ainda confirma depois (Pix tardio): consulta devagar e vira pago", async () => {
    vi.useFakeTimers();
    api.orderStatus.mockResolvedValueOnce({ ...ORDER, status: "expirado" }).mockResolvedValue({ ...ORDER, status: "pago", paidAt: "2026-10-22T17:40:00Z" });
    const Wrap = () => { const [o, setO] = useState<OrderView>({ ...ORDER, status: "expirado" }); return <CheckoutPending {...props} order={o} onOrder={setO} />; };
    render(<Wrap />);
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(screen.getByRole("heading", { name: "Plano Casamento ativo." })).toBeInTheDocument();
  });
  it("B4: Pagar de novo e Escolher outro plano chamam os callbacks", async () => {
    const onNewCheckout = vi.fn(), onChoosePlan = vi.fn();
    render(<CheckoutPending {...props} onNewCheckout={onNewCheckout} onChoosePlan={onChoosePlan} order={{ ...ORDER, status: "expirado" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Pagar de novo" }));
    await userEvent.click(screen.getByRole("button", { name: "Escolher outro plano" }));
    expect(onNewCheckout).toHaveBeenCalled(); expect(onChoosePlan).toHaveBeenCalled();
  });
  it.each(["falhou", "cancelado"] as const)("B5 (%s): texto do plano e Tentar de novo", (status) => {
    render(<CheckoutPending {...props} order={{ ...ORDER, status }} />);
    expect(screen.getByRole("heading", { name: "O pagamento não foi concluído." })).toBeInTheDocument();
    expect(screen.getByText("Nada foi cobrado. Tente de novo em instantes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
  it("estornado e em_disputa têm os textos do plano", () => {
    const { unmount } = render(<CheckoutPending {...props} order={{ ...ORDER, status: "estornado" }} />);
    expect(screen.getByRole("heading", { name: "Pagamento devolvido." })).toBeInTheDocument();
    unmount();
    render(<CheckoutPending {...props} order={{ ...ORDER, status: "em_disputa" }} />);
    expect(screen.getByRole("heading", { name: "Pagamento em análise." })).toBeInTheDocument();
    expect(screen.getByText("Seus convidados continuam usando o evento.")).toBeInTheDocument();
  });
  it("aviso de pedido de outro plano (MM013) aparece sobre o pedido existente, que mantém o próprio link", () => {
    render(<CheckoutPending {...props} order={{ ...ORDER, planCode: "festa", amountCents: 2900 }} warning="Você já tem um pagamento aberto do plano Festa. Conclua esse ou deixe expirar antes de escolher outro plano." />);
    expect(screen.getByTestId("aviso-outro-plano")).toHaveTextContent("plano Festa");
    expect(screen.getByText("Plano Festa · R$ 29,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar para o Mercado Pago" })).toHaveAttribute("href", MP_URL);
  });
  it("retorno (dica) pendente mostra 'Estamos confirmando seu pagamento…' e nunca 'plano ativo'", () => {
    render(<CheckoutPending {...props} order={ORDER} returnHint="sucesso" />);
    expect(screen.getByText("Estamos confirmando seu pagamento…")).toBeInTheDocument();
    expect(screen.queryByText(/ativo\./)).toBeNull();
    expect(screen.getByRole("link", { name: "Continuar para o Mercado Pago" })).toBeInTheDocument();
  });
  it("retorno falha com pedido ainda pendente explica sem afirmar falha do pedido", () => {
    render(<CheckoutPending {...props} order={ORDER} returnHint="falha" />);
    expect(screen.getByText(/Você voltou sem concluir o pagamento/)).toBeInTheDocument();
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
  it("restaura o pedido aberto ao abrir (sem criar outro e sem navegar sozinho)", async () => {
    api.openOrder.mockResolvedValue(ORDER);
    render(<PlanoPage />);
    expect(await screen.findByTestId("checkout-pendente")).toBeInTheDocument();
    expect(api.startCheckout).not.toHaveBeenCalled();
    expect(nav.goToCheckout).not.toHaveBeenCalled();
  });
  it("Pagar cria o pedido e navega (página inteira) para o checkoutUrl do Mercado Pago", async () => {
    api.startCheckout.mockResolvedValue(ORDER);
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" }));
    expect(api.startCheckout).toHaveBeenCalledWith("ev1", "casamento", expect.stringMatching(/^[0-9a-f-]{36}$/));
    await waitFor(() => expect(nav.goToCheckout).toHaveBeenCalledWith(MP_URL));
    expect(await screen.findByTestId("checkout-pendente")).toBeInTheDocument();
  });
  it("clique duplo em Pagar gera um único pedido, com a mesma idempotencyKey, e uma única navegação", async () => {
    let resolve!: (o: OrderView) => void;
    api.startCheckout.mockReturnValue(new Promise<OrderView>((r) => { resolve = r; }));
    render(<PlanoPage />);
    const btn = await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" });
    await userEvent.dblClick(btn);
    expect(api.startCheckout).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(ORDER); });
    expect(await screen.findByTestId("checkout-pendente")).toBeInTheDocument();
    expect(nav.goToCheckout).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("aviso-outro-plano")).toBeNull();
  });
  it("pedido sem checkoutUrl não navega e mantém a tela de pendente", async () => {
    const { checkoutUrl: _c, ...noUrl } = ORDER; void _c;
    api.startCheckout.mockResolvedValue(noUrl);
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" }));
    expect(await screen.findByTestId("checkout-pendente")).toBeInTheDocument();
    expect(nav.goToCheckout).not.toHaveBeenCalled();
  });
  it("409 pedido_aberto de OUTRO plano: mostra o pedido existente com aviso e NÃO navega", async () => {
    api.startCheckout.mockResolvedValue({ ...ORDER, planCode: "festa", amountCents: 2900 });
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" }));
    expect(await screen.findByTestId("aviso-outro-plano")).toHaveTextContent("Você já tem um pagamento aberto do plano Festa.");
    expect(screen.getByText("Plano Festa · R$ 29,00")).toBeInTheDocument();
    expect(nav.goToCheckout).not.toHaveBeenCalled();
  });
  it("502: B6 com botão travado; nenhum pedido novo aparece", async () => {
    api.startCheckout.mockRejectedValue(new ProviderUnavailableError("o9"));
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" }));
    expect(await screen.findByTestId("provedor-fora")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar de novo em/ })).toBeDisabled();
    expect(nav.goToCheckout).not.toHaveBeenCalled();
  });
  it("503 (pagamentos desligados) mostra a mensagem e recarrega o estado", async () => {
    api.startCheckout.mockRejectedValue(new BillingUnavailableError());
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pagamentos indisponíveis no momento.");
  });
  it("erro de negócio vira mensagem de recuperação, sem código técnico", async () => {
    api.startCheckout.mockRejectedValue(new BillingError("ja_incluido", 422));
    render(<PlanoPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Pagar com Mercado Pago · R$ 189,00" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seu evento já tem este plano ou um maior.");
  });
  it("Pagar de novo usa chave nova (nova intenção de compra)", async () => {
    api.openOrder.mockResolvedValue({ ...ORDER, status: "expirado" });
    api.startCheckout.mockResolvedValue(ORDER);
    render(<PlanoPage />);
    await settle();
    sessionStorage.setItem("mm-idem:ev1:casamento", "chave-velha");
    await userEvent.click(await screen.findByRole("button", { name: "Pagar de novo" }));
    expect(api.startCheckout.mock.calls[0][2]).not.toBe("chave-velha");
  });
  it("retorno ?retorno=sucesso sem pedido pago NÃO mostra plano ativo; mostra a confirmação e limpa a URL", async () => {
    window.history.replaceState(null, "", "/painel/ev1/plano?retorno=sucesso&payment_id=999&status=approved&collection_status=approved&external_reference=x&preference_id=p&payment_type=credit_card&merchant_order_id=1");
    api.openOrder.mockResolvedValue(ORDER); // servidor ainda diz pendente
    render(<PlanoPage />);
    expect(await screen.findByText("Estamos confirmando seu pagamento…")).toBeInTheDocument();
    expect(screen.queryByText(/Plano .* ativo\./)).toBeNull();
    expect(screen.queryByTestId("checkout-pago")).toBeNull();
    expect(window.location.search).toBe("");
  });
  it("retorno ?retorno=sucesso com pedido pago no servidor mostra o plano ativo", async () => {
    window.history.replaceState(null, "", "/painel/ev1/plano?retorno=sucesso&status=approved");
    api.openOrder.mockResolvedValue({ ...ORDER, status: "pago", paidAt: "2026-10-22T17:32:00Z" });
    render(<PlanoPage />);
    expect(await screen.findByRole("heading", { name: "Plano Casamento ativo." })).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
  it("retorno ?retorno=sucesso SEM pedido nenhum no servidor volta à escolha de plano, sem plano ativo", async () => {
    window.history.replaceState(null, "", "/painel/ev1/plano?retorno=sucesso&status=approved&payment_id=1");
    render(<PlanoPage />);
    expect(await screen.findByRole("heading", { name: "De que tamanho é a festa?" })).toBeInTheDocument();
    expect(screen.queryByText(/ativo\./)).toBeNull();
    expect(window.location.search).toBe("");
  });
  it("a limpeza da URL preserva ?plano= e remove só o que é do retorno", async () => {
    window.history.replaceState(null, "", "/painel/ev1/plano?plano=casamento&retorno=falha&collection_id=1");
    render(<PlanoPage />);
    await settle();
    expect(window.location.search).toBe("?plano=casamento");
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
