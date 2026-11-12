// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Pessoas from "./page";

const m = vi.hoisted(() => ({ rpc: vi.fn(), role: "support" as string }));
vi.mock("../data", () => ({ requireRole: async () => ({ sb: {}, role: m.role }), rpc: m.rpc }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
afterEach(cleanup);
const counts = { state: "ok", data: { accounts: 3, organizers: 1, guests: 1, invites: 1, team: 2 } };
beforeEach(() => m.rpc.mockReset());

it("equipe para quem não é master: a RPC nega e a aba mostra 'sem permissão'; sem botão de exportar nem de conceder", async () => {
  m.role = "support";
  m.rpc.mockImplementation(async (_s, name) => (name === "admin_people_counts" ? counts : { state: "denied" }));
  render(await Pessoas({ searchParams: Promise.resolve({ aba: "equipe" }) }));
  expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pessoas");
  expect(screen.queryByText("Conceder papel")).toBeNull();
  expect(screen.queryByText("Exportar")).toBeNull();
});

it("convites: pede o estado e a página ao servidor e mostra a lista sem token", async () => {
  m.role = "auditor";
  m.rpc.mockImplementation(async (_s, name) => name === "admin_people_counts" ? counts
    : { state: "ok", data: { total: 1, items: [{ eventTitle: "Ana & Leo", label: "Geral", uses: 2, maxUses: null, expiresAt: null, state: "ativo" }], summary: { total: 1, ativos: 1, expirados: 0, esgotados: 0, revogados: 0 } } });
  render(await Pessoas({ searchParams: Promise.resolve({ aba: "convites", f: "ativos", q: "Geral", p: "1" }) }));
  expect(m.rpc).toHaveBeenCalledWith({}, "admin_search_invites_v2", expect.objectContaining({ p_state: "ativos", p_search: "Geral", p_offset: 0, p_limit: 25 }));
  expect(screen.getByText("2 / sem limite")).toBeTruthy();
  expect(screen.getByText("Exportar")).toBeTruthy(); // auditor exporta
});

it("convites: support não vê o botão Exportar (a RPC também nega)", async () => {
  m.role = "support";
  m.rpc.mockImplementation(async (_s, name) => name === "admin_people_counts" ? counts : { state: "ok", data: { total: 0, items: [], summary: {} } });
  render(await Pessoas({ searchParams: Promise.resolve({ aba: "convites" }) }));
  expect(screen.getByText("Nenhum convite encontrado")).toBeTruthy();
  expect(screen.queryByText("Exportar")).toBeNull();
});

it("erro da RPC mostra o estado de erro com 'Tentar de novo'", async () => {
  m.role = "master";
  m.rpc.mockImplementation(async (_s, name) => (name === "admin_people_counts" ? counts : { state: "error", message: "x" }));
  render(await Pessoas({ searchParams: Promise.resolve({ aba: "contas" }) }));
  expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeTruthy();
});
