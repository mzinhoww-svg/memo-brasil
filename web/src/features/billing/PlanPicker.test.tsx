import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ native: false }));
vi.mock("./checkout-provider", () => ({ validapayCheckoutEnabled: () => flag.native }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));
const api = vi.hoisted(() => ({ quote: vi.fn() }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), quote: api.quote }));

import { PainelFrame } from "@/components/revela/PainelFrame";
import { PlanPicker } from "./PlanPicker";
import type { PublicPlan, PublicSettings } from "./types";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900)];
const SETTINGS: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const OK = { planCode: "casamento", fromPlanCode: null, amountCents: 18900, payable: true, reason: "ok" };
const BLOCKED = { planCode: "casamento", fromPlanCode: null, amountCents: 0, payable: false, reason: "evento_encerrado" };
const onPay = vi.fn();
const props = { eventId: "ev1", plans: PLANS, currentCode: "gratis", settings: SETTINGS, busy: false, onPay, onRedeemed: vi.fn(), usage: { guests: 8, shots: 10 } };
const inFrame = (ui: React.ReactNode) => <PainelFrame title="Plano" eventName="Ana & Rui" backHref="/painel/ev1/configuracoes">{ui}</PainelFrame>;
const foot = (c: HTMLElement) => c.querySelector<HTMLElement>(".pf-foot")!;
const body = (c: HTMLElement) => c.querySelector<HTMLElement>(".pf-body")!;

beforeEach(() => { api.quote.mockReset(); onPay.mockReset(); });

describe.each([
  ["com a flag (ramo nativo, ValidaPay)", true, /^Escolher para Casamento · R\$ 189$/],
  ["sem a flag (ramo Mercado Pago)", false, /^Pagar com Mercado Pago · R\$\s189,00$/],
] as const)("PlanPicker no quadro do painel %s", (_n, native, cta) => {
  beforeEach(() => { flag.native = native; });

  it("o botão principal fica no rodapé fixo do quadro, não no corpo", async () => {
    api.quote.mockResolvedValue(OK);
    const { container } = render(inFrame(<PlanPicker {...props} />));
    const btn = await within(foot(container)).findByRole("button", { name: cta });
    expect(btn).toBeEnabled();
    expect(within(body(container)).queryByRole("button", { name: cta })).toBeNull();
    await userEvent.click(btn);
    expect(onPay).toHaveBeenCalledWith("casamento");
  });

  it("título único: o h1 é o do quadro e o do seletor vira h2", async () => {
    api.quote.mockResolvedValue(OK);
    render(inFrame(<PlanPicker {...props} />));
    await screen.findByRole("button", { name: cta });
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("Plano");
  });

  it("sem `.scr`, sem segunda seta de voltar e sem history.back", async () => {
    api.quote.mockResolvedValue(OK);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const { container } = render(inFrame(<PlanPicker {...props} />));
    await screen.findByRole("button", { name: cta });
    expect(container.querySelector(".scr")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Voltar" })).toHaveLength(1); // a do quadro
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("bloqueio por motivo do servidor: texto no fluxo (corpo) e botão desabilitado no rodapé", async () => {
    api.quote.mockResolvedValue(BLOCKED);
    const { container } = render(inFrame(<PlanPicker {...props} />));
    expect(await within(body(container)).findByText("Este evento já terminou. Não dá para mudar o plano.")).toBeInTheDocument();
    expect(within(foot(container)).getByRole("button")).toBeDisabled();
    expect(within(foot(container)).queryByText(/terminou/)).toBeNull();
  });

  it("erro do pagamento (texto longo) aparece no fluxo, acima do rodapé, e o botão segue no rodapé", async () => {
    api.quote.mockResolvedValue(OK);
    const long = "Não foi possível abrir o pagamento agora. ".repeat(6).trim();
    const { container } = render(inFrame(<PlanPicker {...props} error={long} />));
    const alert = await within(body(container)).findByRole("alert");
    expect(alert).toHaveTextContent(long);
    expect(foot(container).contains(alert)).toBe(false);
    expect(within(foot(container)).getByRole("button", { name: cta })).toBeInTheDocument();
  });

  it("ocupado: botão desabilitado com rótulo de carregamento", async () => {
    api.quote.mockResolvedValue(OK);
    const { container } = render(inFrame(<PlanPicker {...props} busy />));
    const btn = await within(foot(container)).findByRole("button", { name: native ? "Abrindo pagamento…" : "Abrindo o Mercado Pago…" });
    expect(btn).toBeDisabled();
  });

  it("fora do quadro (sem PainelFrame) o botão fica no fluxo", async () => {
    api.quote.mockResolvedValue(OK);
    render(<PlanPicker {...props} />);
    expect(await screen.findByRole("button", { name: cta })).toBeEnabled();
  });
});

describe("PlanPicker: o que muda entre os ramos", () => {
  it("nativo: plano atual, medidores, 'Aumentar para', cartões em carrossel e nota de pagamento no corpo", async () => {
    flag.native = true;
    api.quote.mockResolvedValue(OK);
    const { container } = render(inFrame(<PlanPicker {...props} />));
    await within(foot(container)).findByRole("button");
    const b = body(container);
    expect(within(b).getByText("Plano atual")).toBeInTheDocument();
    expect(within(b).getByText("8 de 10")).toBeInTheDocument();
    expect(within(b).getByRole("heading", { level: 2, name: "Aumentar para" })).toBeInTheDocument();
    expect(within(b).getByRole("radiogroup", { name: "Plano do evento" })).toBeInTheDocument();
    expect(within(b).getByText("Pix ou cartão, sem sair do app")).toBeInTheDocument();
    expect(within(b).queryByTestId("resumo-pedido")).toBeNull();
  });

  it("Mercado Pago: resumo do pedido, nota de pagamento e 'Tenho um código' no corpo; sem `.plano-pagar` sticky", async () => {
    flag.native = false;
    api.quote.mockResolvedValue(OK);
    const { container } = render(inFrame(<PlanPicker {...props} />));
    await within(foot(container)).findByRole("button");
    const b = body(container);
    expect(within(b).getByTestId("resumo-pedido")).toHaveTextContent("Pagamento único");
    expect(within(b).getByText(/Você conclui o pagamento no Mercado Pago/)).toBeInTheDocument();
    expect(within(b).getByText("Tenho um código")).toBeInTheDocument();
    expect(container.querySelector(".plano-pagar")).toBeNull();
  });

  it("nativo: escolher outro cartão muda o rótulo; plano já incluído não é escolhível", async () => {
    flag.native = true;
    api.quote.mockResolvedValue({ planCode: "festa", fromPlanCode: null, amountCents: 2900, payable: true, reason: "ok" });
    const { container } = render(inFrame(<PlanPicker {...props} />));
    await within(foot(container)).findByRole("button", { name: "Escolher para Casamento · R$ 189" });
    await userEvent.click(screen.getByRole("radio", { name: /^Festa/ }));
    expect(await within(foot(container)).findByRole("button", { name: /Escolher para Festa/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /^Grátis/ }));
    expect(within(foot(container)).getByRole("button", { name: /Escolher para Festa/ })).toBeInTheDocument();
  });

  it("só o Grátis (pagamentos desligados): título único no quadro e sem botão de pagar", () => {
    flag.native = true;
    const { container } = render(inFrame(<PlanPicker {...props} plans={[PLANS[0]]} settings={{ ...SETTINGS, paymentsEnv: "desligado" }} />));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("pagamentos-desligados")).toBeInTheDocument();
    expect(foot(container)).toBeEmptyDOMElement();
  });
});
