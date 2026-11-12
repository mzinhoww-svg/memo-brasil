import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ native: false }));
vi.mock("./checkout-provider", () => ({ validapayCheckoutEnabled: () => flag.native }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({ quote: vi.fn() }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), quote: api.quote }));

import { PlanPicker } from "./PlanPicker";
import type { PosePack, PublicPlan, PublicSettings, Quote } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 50, 24, 5990), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900)];
const PACKS: PosePack[] = [
  { code: "festa_36", baseCode: "festa", name: "Festa + Mais poses", maxGuests: 50, maxShots: 36, baseMaxShots: 24, priceCents: 7980, extraCents: 1990, available: true },
  { code: "celebracao_36", baseCode: "celebracao", name: "Celebração + Mais poses", maxGuests: 100, maxShots: 36, baseMaxShots: 24, priceCents: 10890, extraCents: 1990, available: true },
];
const SETTINGS: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const Q = (planCode: string, amountCents: number, over: Partial<Quote> = {}): Quote => ({ planCode, fromPlanCode: "festa", amountCents, payable: true, reason: "ok", ...over });
const onPay = vi.fn();
const base = { eventId: "ev1", plans: PLANS, settings: SETTINGS, busy: false, onPay, onRedeemed: vi.fn(), usage: { guests: 8, shots: 24 }, packs: PACKS };
// cotações do servidor: a variante de quem já tem o plano-base cobra só a diferença
const quotes: Record<string, Quote> = { festa_36: Q("festa_36", 1990), celebracao_36: Q("celebracao_36", 4900), casamento: Q("casamento", 12910), celebracao: Q("celebracao", 2910) };

beforeEach(() => {
  api.quote.mockReset(); onPay.mockReset();
  api.quote.mockImplementation(async (_e: string, code: string) => quotes[code] ?? Q(code, 0, { payable: false, reason: "ja_incluido" }));
});

describe.each([[true, "ramo nativo (ValidaPay)"], [false, "ramo Mercado Pago"]] as const)("cartão Mais poses no painel: %s", (native) => {
  beforeEach(() => { flag.native = native; });

  it("Festa sem pacote: mostra o cartão com a cotação do servidor e paga a variante", async () => {
    render(<PlanPicker {...base} currentCode="festa" />);
    const card = await screen.findByTestId("cartao-mais-poses");
    expect(card).toHaveTextContent("de 24 para 36 por pessoa");
    const btn = await screen.findByRole("button", { name: "Adicionar Mais poses · R$ 19,90" });
    await userEvent.click(btn);
    expect(onPay).toHaveBeenCalledWith("festa_36");
    expect(api.quote).toHaveBeenCalledWith("ev1", "festa_36");
  });
  it("Celebração sem pacote: cartão da variante da Celebração", async () => {
    api.quote.mockImplementation(async (_e: string, code: string) => (code === "celebracao_36" ? Q(code, 1990, { fromPlanCode: "celebracao" }) : Q(code, 18900)));
    render(<PlanPicker {...base} currentCode="celebracao" />);
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar Mais poses · R$ 19,90" }));
    expect(onPay).toHaveBeenCalledWith("celebracao_36");
  });
  it("quem já tem o pacote não vê o cartão", async () => {
    render(<PlanPicker {...base} currentCode="festa" hasPack />);
    await screen.findAllByRole("radio");
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
  });
  it("Grátis, Casamento ou pacote desligado: sem cartão", async () => {
    const { unmount } = render(<PlanPicker {...base} currentCode="gratis" />);
    await screen.findAllByRole("radio");
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
    unmount();
    const c = render(<PlanPicker {...base} currentCode="casamento" />);
    await screen.findAllByRole("radio");
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
    c.unmount();
    render(<PlanPicker {...base} currentCode="festa" packs={[{ ...PACKS[0], available: false }]} />);
    await screen.findAllByRole("radio");
    expect(screen.queryByTestId("cartao-mais-poses")).toBeNull();
  });
  it("a cotação que diz 'não dá' (ex.: já incluído) esconde o cartão", async () => {
    api.quote.mockImplementation(async (_e: string, code: string) => Q(code, 0, { payable: false, reason: "ja_incluido" }));
    render(<PlanPicker {...base} currentCode="festa" />);
    await waitFor(() => expect(api.quote).toHaveBeenCalledWith("ev1", "festa_36"));
    await waitFor(() => expect(screen.queryByTestId("cartao-mais-poses")).toBeNull());
  });
});

describe("planos maiores levam o pacote", () => {
  beforeEach(() => { flag.native = false; });
  it("quem tem Festa + pacote e escolhe Celebração paga a Celebração + Mais poses (interruptor travado ligado)", async () => {
    render(<PlanPicker {...base} currentCode="festa" hasPack initialPlan="celebracao" />);
    const sw = await screen.findByRole("switch", { name: /Mais poses/ });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(api.quote).toHaveBeenCalledWith("ev1", "celebracao_36"));
    await userEvent.click(await screen.findByRole("button", { name: /Pagar com Mercado Pago/ }));
    expect(onPay).toHaveBeenCalledWith("celebracao_36");
  });
  it("?plano=festa_36 (assistente) pré-seleciona o plano-base com o pacote ligado", async () => {
    render(<PlanPicker {...base} currentCode="gratis" initialPlan="festa_36" />);
    const sw = await screen.findByRole("switch", { name: /Mais poses/ });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(api.quote).toHaveBeenCalledWith("ev1", "festa_36"));
    expect(screen.getByRole("radio", { name: /Até 50/ })).toBeChecked();
  });
  it("sem ?plano=, o interruptor nasce desligado e pode ser ligado; o Casamento não tem interruptor", async () => {
    render(<PlanPicker {...base} currentCode="gratis" initialPlan="festa" />);
    const sw = await screen.findByRole("switch", { name: /Mais poses/ });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(screen.getByRole("switch", { name: /Mais poses/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: /Até 250/ }));
    expect(screen.queryByRole("switch", { name: /Mais poses/ })).toBeNull();
  });
});

describe("seletor nunca lista a variante", () => {
  it("os cartões são só os planos do catálogo visível", async () => {
    flag.native = false;
    render(<PlanPicker {...base} currentCode="gratis" />);
    const radios = await screen.findAllByRole("radio");
    expect(radios).toHaveLength(PLANS.length); // Grátis, Festa, Celebração, Casamento: nenhuma variante
    expect(screen.queryByRole("radio", { name: /Mais poses/ })).toBeNull();
  });
});
