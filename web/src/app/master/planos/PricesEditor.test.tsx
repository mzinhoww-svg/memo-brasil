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
  const f = screen.getByLabelText("Preço de Festa");
  fireEvent.change(f, { target: { value: v } });
  fireEvent.blur(f);
}

describe("PricesEditor (M03/M04)", () => {
  it("sem alteração não há barra de não publicadas", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    expect(screen.queryByText(/não publicadas/)).toBeNull();
  });
  it("editar preço mostra a barra, atualiza a prévia ao vivo e Descartar volta ao original", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    changeFestaPrice("39,00");
    expect(screen.getByText(/1 plano com alteração/)).toBeTruthy();
    const preview = screen.getByRole("group", { name: "Prévia do paywall no celular" });
    expect(within(preview).getByText("R$ 39,00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByText(/não publicadas/)).toBeNull();
  });
  it("preço inválido bloqueia a publicação", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    fireEvent.change(screen.getByLabelText("Convidados de Festa"), { target: { value: "5000" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Convidados/);
    expect((screen.getByRole("button", { name: "Publicar preços" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("Destacar troca o destaque (só um)", () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    fireEvent.click(screen.getByLabelText("Destacar Festa"));
    expect((screen.getByLabelText("Destacar Festa") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Destacar Casamento") as HTMLInputElement).checked).toBe(false);
  });
  it("publicar abre a confirmação de → para e exige motivo e código TOTP; só então chama o servidor", async () => {
    render(<PricesEditor plans={plans} env="sandbox" />);
    changeFestaPrice("39,00");
    fireEvent.click(screen.getByRole("button", { name: "Publicar preços" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("R$ 29,00")).toBeTruthy();
    expect(within(sheet).getByText("R$ 39,00")).toBeTruthy();
    expect(within(sheet).getByText(/Pix já aberto mantém o valor cotado/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Publicar preços" }));
    expect(rpc).not.toHaveBeenCalled();
    expect(within(sheet).getAllByText(/motivo|6 números/i).length).toBeGreaterThan(0);
    fireEvent.change(within(sheet).getByLabelText(/Motivo/), { target: { value: "Reajuste anual do plano Festa" } });
    fireEvent.change(within(sheet).getByLabelText("Código do autenticador"), { target: { value: "123456" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Publicar preços" }));
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
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText(/Motivo/), { target: { value: "Reajuste anual do plano Festa" } });
    fireEvent.change(within(sheet).getByLabelText("Código do autenticador"), { target: { value: "000000" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Publicar preços" }));
    expect(await within(sheet).findByText(/Código incorreto/)).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
