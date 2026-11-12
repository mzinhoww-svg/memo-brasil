import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Pagamentos from "./pagamentos/page";
import Codigos from "./codigos/page";
import Revelacoes from "./revelacoes/page";
import Moderacao from "./moderacao/page";
import Lgpd from "./lgpd/page";
import { MasterPager } from "./MasterPager";

const m = vi.hoisted(() => ({ rpc: vi.fn(), access: vi.fn() }));
vi.mock("./data", () => ({ requireMaster: async () => { m.access(); return {}; }, rpc: m.rpc }));
vi.mock("./ExportButton", () => ({ ExportButton: () => null }));
vi.mock("./ReconcileButton", () => ({ ReconcileButton: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => {
  m.access.mockClear();
  m.rpc.mockReset();
  m.rpc.mockImplementation(async (_sb, name: string) => ({ state: "ok", data:
    name === "admin_master_list" ? { total: 76, items: [], counts: { fotos: 106, comentarios: 77, bloqueados: 36 }, needsRefund: 49, slaDays: 15 } :
    name === "admin_list_plans" || name === "admin_payment_divergences" ? [] :
    name === "admin_payments_summary" ? { byStatus: {}, paid30d: { amountCents: 0, count: 0 }, pendingOver1h: 0 } :
    { photosAfterEndDays: 90, unrevealedAfterEndDays: 90, ipHashDays: null, backupDays: null } }));
});

it.each([
  [Pagamentos, "pagamentos", { f: "cartao" }],
  [Codigos, "codigos", {}],
  [Revelacoes, "revelacoes", {}],
  [Moderacao, "comentarios", { aba: "comentarios" }],
  [Lgpd, "lgpd", {}],
] as const)("lista %s busca e filtra no servidor antes da página de 25", async (Page, kind, extra) => {
  render(await Page({ searchParams: Promise.resolve({ ...extra, p: "3", q: "Alvo antigo" }) }));
  expect(m.access).toHaveBeenCalledOnce();
  expect(m.rpc).toHaveBeenCalledWith({}, "admin_master_list", { p_kind: kind, p_search: "Alvo antigo", p_offset: 50, ...(kind === "pagamentos" ? { p_filter: "cartao" } : {}) });
  expect(screen.getByRole("navigation", { name: "Paginação" })).toHaveTextContent("Página 3 de 4");
  const next = screen.getByRole("link", { name: "Próxima →" });
  expect(next).toHaveAttribute("href", expect.stringContaining("p=4"));
  expect(next).toHaveAttribute("href", expect.stringContaining("q=Alvo+antigo"));
  if (kind === "pagamentos") {
    expect(next).toHaveAttribute("href", expect.stringContaining("f=cartao"));
    expect(screen.getByText("49")).toBeVisible();
  }
  if (kind === "comentarios") {
    expect(next).toHaveAttribute("href", expect.stringContaining("aba=comentarios"));
    expect(screen.getByRole("link", { name: "Fotos 106" })).toBeVisible();
  }
});
it("não acrescenta controle de página em lista de até 25", () => {
  const view = render(<MasterPager total={25} page={1} path="/master/codigos" />);
  expect(view.container).toBeEmptyDOMElement();
});
it("MM004 mantém estado negado em vez de tabela vazia", async () => {
  m.rpc.mockResolvedValue({ state: "denied" });
  render(await Pagamentos({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Sem permissão para ver estes dados.")).toBeVisible();
});
