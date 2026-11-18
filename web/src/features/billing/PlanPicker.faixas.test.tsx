import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ native: false }));
vi.mock("./checkout-provider", () => ({ validapayCheckoutEnabled: () => flag.native }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({ quote: vi.fn() }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), quote: api.quote }));

import { salesContactHref } from "@/lib/contact";
import { PlanPicker } from "./PlanPicker";
import type { PublicPlan, PublicSettings } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, extra: Partial<PublicPlan> = {}): PublicPlan =>
  ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: cents === 0, features: [], ...extra });
const GRATIS = P("gratis", "Grátis", 10, 10, 0);
const ATE150 = P("ate150", "Até 150 convidados", 150, 36, 14700, { highlighted: true });
const ATE300 = P("ate300", "Até 300 convidados", 300, 36, 29700);
const CASAMENTO = P("casamento", "Casamento", 250, 36, 18900); // plano antigo, fora do catálogo visível
const PLANS = [GRATIS, ATE150, ATE300];
const SETTINGS: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const base = { eventId: "ev1", plans: PLANS, currentCode: "gratis", settings: SETTINGS, busy: false, onPay: vi.fn(), onRedeemed: vi.fn(), usage: { guests: 10, shots: 10 } };
const quoteOf = (code: string) => ({ planCode: code, fromPlanCode: null, amountCents: code === "ate300" ? 29700 : 14700, payable: true, reason: "ok" });

beforeEach(() => { api.quote.mockReset(); api.quote.mockImplementation((_e: string, c: string) => Promise.resolve(quoteOf(c))); });

describe.each([["nativo", true], ["Mercado Pago", false]] as const)("PlanPicker por faixa de convidados (%s)", (_n, native) => {
  beforeEach(() => { flag.native = native; });

  it("no Grátis: pergunta os convidados, oferece as duas faixas e pré-seleciona a de 150 (destaque do catálogo)", async () => {
    render(<PlanPicker {...base} />);
    if (!native) expect(screen.getByRole("heading", { name: "Quantos convidados vão à festa?" })).toBeInTheDocument();
    expect(await screen.findByRole("radio", { name: /Até 150 convidados/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Até 300 convidados/ })).not.toBeChecked();
    expect(screen.getByRole("link", { name: /Fale no WhatsApp/ })).toHaveAttribute("href", salesContactHref());
  });

  it("já no maior plano: nenhuma faixa para escolher, só o WhatsApp", async () => {
    render(<PlanPicker {...base} currentCode="ate300" currentPlan={ATE300} />);
    expect(screen.getByRole("link", { name: /Fale no WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Até 150 convidados/, checked: true })).toBeNull();
    expect(screen.queryByRole("button", { name: /· R\$/ })).toBeNull();
  });

  it("plano antigo (Casamento, 250): mostra o plano atual e oferece só a faixa maior", async () => {
    render(<PlanPicker {...base} currentCode="casamento" currentPlan={CASAMENTO} />);
    expect(await screen.findByRole("radio", { name: /Até 300 convidados/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Até 150 convidados/, checked: true })).toBeNull();
    if (native) expect(screen.getByText(/Casamento · R\$ 189/)).toBeInTheDocument();
  });
});
