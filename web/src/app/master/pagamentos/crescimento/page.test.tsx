// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRole } from "@/lib/master/access";
import type { GrowthCohort } from "@/features/growth/cohort";

const mock = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("../../data", async () => {
  const { requireRole } = await import("../../gate");
  const rpc = async (sb: { rpc: (name: string, args?: unknown) => Promise<{data: unknown; error: {code?: string; message: string} | null}> }, name: string, args?: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(name, args ?? {});
    if (!error) return { state: "ok", data };
    return error.code === "MM004" ? { state: "denied" } : { state: "error", message: error.message };
  };
  return { requireRole, rpc };
});
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, usePathname: () => "/master/pagamentos/crescimento" }));
vi.mock("@/lib/master/server", () => ({ masterAccess: mock.session, printedAlbumOn: vi.fn(async () => false) }));
import Crescimento from "./page";

const STATS: GrowthCohort = {
  days: 7, timezone: "America/Cuiaba",
  from: "2026-11-13T04:00:00Z", toExclusive: "2026-11-20T04:00:00Z", generatedAt: "2026-11-19T18:00:00Z",
  totals: { created: 10, withGuests: 5, withPhotos: 4, activated: 3, checkoutEvents: 5, paidEvents: 2, courtesyEvents: 1, paidOrders: 3, paidCents: 44400, reversedOrDisputedOrders: 1 },
  series: [{ day: "2026-11-19", created: 10, activated: 3, checkoutEvents: 5, paidEvents: 2 }],
};
const setup = (role: PlatformRole | null, data: unknown = STATS, error: { code?: string; message: string } | null = null) => {
  mock.rpc.mockImplementation(async () => ({ data, error }));
  mock.session.mockResolvedValue({ access: role ? "ok" : "forbidden", role, sb: role ? { rpc: mock.rpc } : null, user: { name: "teste" } });
};
const open = async (ui: Promise<ReactNode>) => render(<>{await ui}</>);
const params = (days?: string) => Promise.resolve({ dias: days });

beforeEach(() => { mock.session.mockReset(); mock.rpc.mockReset(); });
afterEach(cleanup);

describe("GF-01 · rota Master de crescimento", () => {
  it("mostra coorte, valores reais em centavos e limites de atribuição", async () => {
    setup("master");
    await open(Crescimento({ searchParams: params("7") }));
    expect(screen.getByRole("heading", { level: 1, name: "Funil de crescimento" })).toBeTruthy();
    expect(screen.getByText("Eventos criados")).toBeTruthy();
    expect(screen.getByText("40,0% dos que iniciaram checkout")).toBeTruthy();
    expect(screen.getByText(/444,00/)).toBeTruthy();
    expect(screen.getByText(/não são vinculadas a estas coortes/)).toBeTruthy();
    expect(mock.rpc).toHaveBeenCalledWith("admin_growth_cohort", { p_days: 7 });
  });
  it("normaliza dias inválidos para 30", async () => {
    setup("master");
    await open(Crescimento({ searchParams: params("200") }));
    expect(mock.rpc).toHaveBeenCalledWith("admin_growth_cohort", { p_days: 30 });
  });
  it("impede suporte, auditoria e anfitrião de abrir métricas financeiras", async () => {
    for (const role of ["support", "auditor"] as const) {
      cleanup(); setup(role);
      await open(Crescimento({ searchParams: params() }));
      expect(mock.rpc).not.toHaveBeenCalled();
    }
    cleanup(); setup(null);
    await expect(Crescimento({ searchParams: params() })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("separa vazio, erro e acesso negado pelo banco", async () => {
    setup("master", { ...STATS, totals: { ...STATS.totals, created: 0 } });
    await open(Crescimento({ searchParams: params() }));
    expect(screen.getByText("Ainda sem eventos nesta coorte")).toBeTruthy();
    cleanup(); setup("master", null, { message: "unavailable" });
    await open(Crescimento({ searchParams: params() }));
    expect(screen.getByText(/Não foi possível carregar/)).toBeTruthy();
    cleanup(); setup("master", null, { code: "MM004", message: "forbidden" });
    await open(Crescimento({ searchParams: params() }));
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
  });
});
