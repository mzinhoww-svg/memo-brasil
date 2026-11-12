// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanRow } from "../prices";
import { PricesEditor } from "./PricesEditor";

const rpc = vi.hoisted(() => vi.fn(async () => ({ error: null })));
const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(async () => ({ data: { totp: [{ id: "f1", status: "verified" }] } })),
  challenge: vi.fn(async () => ({ data: { id: "c1" }, error: null })),
  verify: vi.fn(async () => ({ error: null })),
  enroll: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc, auth: { mfa } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const plans: PlanRow[] = [
  { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, sandboxActive: true, productionActive: true, highlighted: false, isFree: true, sort: 0 },
  { code: "festa", name: "Festa", maxGuests: 30, maxShots: 24, priceCents: 2900, sandboxActive: true, productionActive: true, highlighted: false, isFree: false, sort: 1 },
  { code: "casamento", name: "Casamento", maxGuests: 250, maxShots: 36, priceCents: 18900, sandboxActive: true, productionActive: true, highlighted: true, isFree: false, sort: 3 },
];
beforeEach(() => { rpc.mockClear(); mfa.verify.mockClear(); refresh.mockClear(); });
afterEach(cleanup);

function changeFestaPrice(v: string) {
  const f = screen.getByLabelText("Preço Festa");
  fireEvent.change(f, { target: { value: v } });
  fireEvent.blur(f);
}

describe("PricesEditor (M03/M04)", () => {
  it("sem alteração não há barra de não publicadas", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    expect(screen.queryByText(/não publicada/)).toBeNull();
  });
  it("editar preço mostra a barra, o valor antigo, atualiza a prévia ao vivo e Descartar volta ao original", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    changeFestaPrice("39,00");
    expect(screen.getByText("1 alteração não publicada")).toBeTruthy();
    expect(screen.getByText("Festa: R$ 29,00 → R$ 39,00")).toBeTruthy();
    expect(screen.getByText(/era R\$ 29,00/)).toBeTruthy();
    const preview = screen.getByRole("group", { name: "Prévia do paywall no celular" });
    expect(within(preview).getByText("R$ 39")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByText(/não publicada/)).toBeNull();
  });
  it("preço inválido volta ao valor anterior; limite inválido bloqueia a publicação", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    const f = screen.getByLabelText("Preço Festa") as HTMLInputElement;
    fireEvent.change(f, { target: { value: "abc" } });
    fireEvent.blur(f);
    expect(f.value).toBe("29,00");
    fireEvent.change(screen.getByLabelText("Convidados Festa"), { target: { value: "5000" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Convidados/);
    expect((screen.getByRole("button", { name: "Publicar preços" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("Destacar troca o destaque (só um)", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    expect(screen.queryByLabelText("Destacar Casamento")).toBeNull();
    fireEvent.click(screen.getByLabelText("Destacar Festa"));
    expect(screen.queryByLabelText("Destacar Festa")).toBeNull();
    expect(screen.getByLabelText("Destacar Casamento")).toBeTruthy();
  });
  it("publicar abre a confirmação de → para com o impacto e exige motivo e código TOTP; só então chama o servidor", async () => {
    render(<PricesEditor plans={plans} env="sandbox" impact={{ festa: { paid: 7, open: 2 } }} />);
    changeFestaPrice("39,00");
    fireEvent.click(screen.getByRole("button", { name: "Publicar preços" }));
    const reasonSheet = screen.getByRole("dialog", { name: "Publicar novo preço?" });
    fireEvent.click(within(reasonSheet).getByRole("button", {name:"Continuar"}));
    expect(rpc).not.toHaveBeenCalled();
    expect(within(reasonSheet).getByText(/motivo.*10.*500/i)).toBeTruthy();
    fireEvent.change(within(reasonSheet).getByLabelText(/Motivo/), {target:{value:"Reajuste anual do plano Festa"}});
    fireEvent.click(within(reasonSheet).getByRole("button", {name:"Continuar"}));
    const sheet = screen.getByRole("dialog", {name:"Publicar novo preço?"});
    expect(within(sheet).queryByLabelText(/Motivo/)).toBeNull();
    expect(within(sheet).getByText("R$ 29,00")).toBeTruthy();
    expect(within(sheet).getByText("R$ 39,00")).toBeTruthy();
    expect(within(sheet).getByText("7 eventos já pagos continuam iguais")).toBeTruthy();
    expect(within(sheet).getByText("2 Pix abertos mantêm R$ 29,00 até expirar")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"Publicar preços"})).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Publicar R$ 39" }));
    expect(rpc).not.toHaveBeenCalled();
    expect(within(sheet).getAllByText(/motivo|6 números/i).length).toBeGreaterThan(0);
    fireEvent.change(within(sheet).getByLabelText("Código do autenticador"), { target: { value: "123456" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Publicar R$ 39" }));
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: "f1", challengeId: "c1", code: "123456" });
    const [fn, args] = rpc.mock.calls[0] as unknown as [string, { p_changes: { code: string; priceCents: number }[]; p_reason: string }];
    expect(fn).toBe("admin_publish_plans");
    expect(args.p_changes).toEqual([expect.objectContaining({ code: "festa", priceCents: 3900 })]);
    expect(args.p_reason).toBe("Reajuste anual do plano Festa");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it("código TOTP errado não publica", async () => {
    mfa.verify.mockResolvedValueOnce({ error: { message: "bad" } } as never);
    render(<PricesEditor plans={plans} env="sandbox" />);
    changeFestaPrice("39,00");
    fireEvent.click(screen.getByRole("button", { name: "Publicar preços" }));
    const reasonSheet = screen.getByRole("dialog");
    fireEvent.change(within(reasonSheet).getByLabelText(/Motivo/), {target:{value:"Reajuste anual do plano Festa"}});
    fireEvent.click(within(reasonSheet).getByRole("button",{name:"Continuar"}));
    const sheet=screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText("Código do autenticador"), { target: { value: "000000" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Publicar R$ 39" }));
    expect(await within(sheet).findByText(/Código incorreto/)).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
