// @vitest-environment jsdom
/* Master · Acessos: papéis, períodos e estados (vazio, erro) da tela de estatísticas de acesso. */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRole } from "@/lib/master/access";

const m = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn() }));
vi.mock("../data", async () => {
  const { requireRole } = await import("../gate");
  const rpc = async (sb: { rpc: (n: string, a?: unknown) => Promise<{ data: unknown; error: { code?: string; message: string } | null }> }, name: string, args?: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(name, args ?? {});
    if (!error) return { state: "ok", data };
    return error.code === "MM004" || /forbidden/i.test(error.message) ? { state: "denied" } : { state: "error", message: error.message };
  };
  return { requireRole, rpc };
});
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/master/acessos" }));
vi.mock("@/lib/master/server", () => ({ masterAccess: m.session, printedAlbumOn: vi.fn(async () => true) }));

import Acessos from "./page";

const STATS = {
  days: 7, generatedAt: "2026-11-17T12:00:00Z",
  totals: { visitors: 120, views: 300, entries: 90 },
  series: Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-${String(11 + i).padStart(2, "0")}`, visitors: i * 5, views: i * 12 })),
  sources: [{ source: "Instagram", medium: "social", entries: 40, visitors: 38 }, { source: "Direto", medium: "direto", entries: 30, visitors: 28 }, { source: "Google", medium: "orgânico", entries: 20, visitors: 19 }],
  campaigns: [{ campaign: "lancamento", source: "Instagram", entries: 25 }],
  referrers: [{ host: "l.instagram.com", entries: 40 }],
  pages: [{ path: "/", views: 100, visitors: 80 }, { path: "/e/:codigo/agora", views: 60, visitors: 30 }],
  devices: [{ device: "celular", visitors: 90 }, { device: "computador", visitors: 30 }],
  browsers: [{ browser: "Chrome", visitors: 70 }],
  countries: [{ country: "BR", visitors: 110 }, { country: "PT", visitors: 10 }],
};
const as = (role: PlatformRole | null, data: unknown = STATS, error: { code?: string; message: string } | null = null) => {
  m.rpc.mockImplementation(async () => ({ data, error }));
  m.session.mockResolvedValue({ access: role ? "ok" : "forbidden", role, sb: role ? { rpc: m.rpc } : null, user: { name: "x" } });
};
const open = async (ui: Promise<ReactNode>) => render(<>{await ui}</>);
const sp = (o: { dias?: string }) => Promise.resolve(o);
beforeEach(() => { m.session.mockReset(); m.rpc.mockReset(); });
afterEach(cleanup);

describe("Master · Acessos", () => {
  it("mostra totais, origem, páginas, aparelhos e países (com nomes em português)", async () => {
    as("master");
    await open(Acessos({ searchParams: sp({ dias: "7" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Acessos" })).toBeTruthy();
    expect(screen.getAllByText("120").length).toBeGreaterThan(0); // cartão e total do gráfico
    expect(screen.getByText("300")).toBeTruthy();
    expect(screen.getByText("2,5")).toBeTruthy(); // 300 vistas ÷ 120 visitantes
    expect(screen.getAllByText("Instagram").length).toBe(2); // origem e campanha
    expect(screen.getByText("Rede social")).toBeTruthy();
    expect(screen.getByText("Busca")).toBeTruthy();
    expect(screen.getByText("l.instagram.com")).toBeTruthy();
    expect(screen.getByText("/e/:codigo/agora")).toBeTruthy();
    expect(screen.getByText("Brasil")).toBeTruthy();
    expect(screen.getByText("Portugal")).toBeTruthy();
    expect(screen.getByText("Campanhas (UTM)")).toBeTruthy();
    expect(screen.getByText("lancamento")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Visitantes por dia/ })).toBeTruthy();
  });
  it("o período vem da URL (só 1, 7, 30 ou 90) e é pedido à RPC; o ativo fica marcado", async () => {
    as("master");
    const { container } = await open(Acessos({ searchParams: sp({ dias: "30" }) }));
    expect(m.rpc).toHaveBeenCalledWith("admin_access_stats", { p_days: 30 });
    expect(container.querySelector(".seg a.on")?.textContent).toBe("30 dias");
    cleanup(); m.rpc.mockClear();
    await open(Acessos({ searchParams: sp({ dias: "999" }) }));
    expect(m.rpc).toHaveBeenCalledWith("admin_access_stats", { p_days: 7 });
  });
  it("support e auditor abrem a leitura; quem não tem papel não abre", async () => {
    for (const role of ["support", "auditor"] as const) { cleanup(); as(role); await open(Acessos({ searchParams: sp({}) })); expect(screen.getByText("Visitantes por dia")).toBeTruthy(); }
    cleanup(); as(null);
    await expect(Acessos({ searchParams: sp({}) })).rejects.toThrow();
  });
  it("sem nenhuma visita medida mostra o estado vazio explicando que a medição começou", async () => {
    as("master", { ...STATS, totals: { visitors: 0, views: 0, entries: 0 } });
    await open(Acessos({ searchParams: sp({}) }));
    expect(screen.getByText("Ainda sem visitas medidas")).toBeTruthy();
  });
  it("erro e falta de permissão do servidor viram os estados da tela", async () => {
    as("master", null, { message: "boom" });
    await open(Acessos({ searchParams: sp({}) }));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    cleanup(); as("master", null, { code: "MM004", message: "forbidden" });
    await open(Acessos({ searchParams: sp({}) }));
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
  });
});
