// @vitest-environment jsdom
/* /master/pagamentos: só master; "Conciliar agora" e "Exportar" abrem as folhas únicas (M23, M24). */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireRole: vi.fn(), rpc: vi.fn(), hasAal2: vi.fn() }));
vi.mock("../data", () => ({ requireRole: m.requireRole, rpc: m.rpc }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1" } }), listFactors: async () => ({ data: { totp: [] } }) } } }) }));
import Pagamentos from "./page";

afterEach(cleanup);
const ok = <T,>(data: T) => ({ state: "ok" as const, data });
const order = { orderId: "abcdef12-0000-4000-8000-000000000000", createdAt: "2026-11-12T12:00:00Z", eventTitle: "Ana & Leo", planCode: "casamento", planName: "Casamento", amountCents: 18900, status: "pago", paymentMethod: "pix", needsRefund: false, refundRequestedAt: null };
beforeEach(() => {
  m.requireRole.mockReset(); m.rpc.mockReset();
  m.rpc.mockImplementation(async (_sb: unknown, name: string) => ({
    admin_payments_summary: ok({ byStatus: { pendente: { count: 3, amountCents: 72700 } }, paid30d: { count: 71, amountCents: 1243000 }, pendingOver1h: 0 }),
    admin_list_payments: ok([order]), admin_payment_divergences: ok([]), admin_list_audit: ok({ items: [{ at: "2026-11-12T12:51:00Z" }] }),
  } as Record<string, unknown>)[name]);
});

describe("Pagamentos: papel e folhas", () => {
  it("support e auditor não chegam à lista (a M32 vem de requireRole)", async () => {
    m.requireRole.mockResolvedValue({ denied: <p>M32 acesso limitado</p> });
    render(await Pagamentos({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("M32 acesso limitado")).toBeTruthy();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("master: Conciliar agora sem aal2 pede o código do autenticador; Exportar abre a folha com o filtro da tela", async () => {
    m.requireRole.mockResolvedValue({ sb: {}, role: "master" });
    render(await Pagamentos({ searchParams: Promise.resolve({ f: "pix" }) }));
    expect(screen.queryByText("Conciliar agora", { selector: "h2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Conciliar agora" }));
    expect(await screen.findByText("Código do app autenticador")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    const sheet = screen.getByRole("dialog", { name: "Exportar" });
    expect(sheet.textContent).toContain("Pagamentos");
    expect(sheet.textContent).toContain("Pix");
  });
  it("erro e negado do banco: estado com o nome da área", async () => {
    m.requireRole.mockResolvedValue({ sb: {}, role: "master" });
    m.rpc.mockImplementation(async (_sb: unknown, name: string) => (name === "admin_list_payments" ? { state: "denied" } : ok({})));
    render(await Pagamentos({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Pagamentos" })).toBeTruthy();
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
  });
});
