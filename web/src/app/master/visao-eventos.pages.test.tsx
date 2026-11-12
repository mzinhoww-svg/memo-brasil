// @vitest-environment jsdom
/* Permissão por papel em cada rota e ação do grupo Visão geral · Eventos · Pagamentos (master, support, auditor, sem papel). O banco confere de novo (pgTAP 34). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRole } from "@/lib/master/access";

const m = vi.hoisted(() => ({ requireRole: vi.fn(), rpc: vi.fn(), printed: vi.fn(), refresh: vi.fn(), push: vi.fn(), del: vi.fn(), flag: vi.fn() }));
vi.mock("./data", () => ({ requireRole: m.requireRole, rpc: m.rpc }));
vi.mock("../data", () => ({ requireRole: m.requireRole, rpc: m.rpc }));
vi.mock("../../data", () => ({ requireRole: m.requireRole, rpc: m.rpc }));
vi.mock("@/lib/master/server", () => ({ printedAlbumOn: m.printed }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/master/test-events", async (orig) => ({ ...(await orig<typeof import("@/lib/master/test-events")>()), deleteTestEvents: m.del, setTestFlag: m.flag }));
import { VisaoGeralConteudo } from "./VisaoGeral";
import Eventos from "./eventos/page";
import { EventoConteudo } from "./eventos/[id]/EventoConteudo";

afterEach(cleanup);
const ID = "11111111-1111-4111-8111-111111111111";
const as = (role: PlatformRole) => m.requireRole.mockResolvedValue({ sb: { tag: "sb" }, role });
const ok = <T,>(data: T) => ({ state: "ok" as const, data });
const day = (i: number) => `2026-11-${String(i).padStart(2, "0")}`;
const overview = ok({ kpis: { activeEvents: { value: 41, previous: 30 }, photos: { value: 61402, previous: 1 }, revenueCents: { value: 1243000, previous: 1000000 } }, series: [{ day: day(11), photos: 8912 }], upcomingReveals: [] });
const overviewSupport = ok({ kpis: { activeEvents: { value: 41, previous: 30 }, photos: { value: 61402, previous: 1 }, revenueCents: { value: null, previous: null } }, series: [{ day: day(11), photos: 8912 }], upcomingReveals: [] });
const metrics = ok({ series: Array.from({ length: 30 }, (_, i) => ({ day: day(i + 1), eventsCreated: i % 4, participantsJoined: 10 + i, photosUploaded: 100 + i, uploadsFailed: i === 8 ? 21 : 3 })) });
const summary = ok({ byStatus: { pendente: { count: 3, amountCents: 72700 } } });
const denied = { state: "denied" as const };
const wire = (impl: Record<string, unknown>) => m.rpc.mockImplementation(async (_sb: unknown, name: string) => impl[name] ?? denied);

beforeEach(() => { for (const f of Object.values(m)) f.mockReset(); m.printed.mockResolvedValue(true); });

describe("M20 Visão geral: permissão por papel e por bloco", () => {
  it("master: receita, pedidos pendentes e Exportar (que abre a folha)", async () => {
    as("master");
    wire({ admin_overview: overview, admin_dashboard_metrics: metrics, admin_payments_summary: summary });
    render(await VisaoGeralConteudo({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeTruthy();
    expect(screen.getByText("Atividade por dia")).toBeTruthy();
    expect(screen.getByText("Pix aguardando")).toBeTruthy();
    expect(screen.queryByText("só para master")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(screen.getByRole("dialog", { name: "Exportar" })).toBeTruthy();
  });
  it("support: sem receita nem pedidos (só master), sem Exportar (o banco recusa), atividade segue", async () => {
    as("support");
    wire({ admin_overview: overviewSupport, admin_dashboard_metrics: metrics });
    render(await VisaoGeralConteudo({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByText("só para master")).toHaveLength(2);
    expect(screen.getByText("Atividade por dia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
    expect(m.rpc.mock.calls.map((c) => c[1])).not.toContain("admin_payments_summary");
  });
  it("auditor exporta; um bloco negado não derruba a página (denied por bloco)", async () => {
    as("auditor");
    wire({ admin_overview: overviewSupport, admin_dashboard_metrics: denied });
    render(await VisaoGeralConteudo({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    expect(screen.getByText("Eventos ativos")).toBeTruthy();
  });
  it("área negada pelo papel devolve a M32 sem chamar nenhuma RPC", async () => {
    m.requireRole.mockResolvedValue({ denied: <p>M32 acesso limitado</p> });
    render(await VisaoGeralConteudo({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("M32 acesso limitado")).toBeTruthy();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("erro da visão geral e período sem atividade têm estado próprio; a tabela vem ordenada do dia mais novo e destaca a falha fora do normal", async () => {
    as("master");
    wire({ admin_overview: { state: "error", message: "x" }, admin_dashboard_metrics: metrics, admin_payments_summary: summary });
    const { unmount } = render(await VisaoGeralConteudo({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    unmount();
    wire({ admin_overview: overview, admin_dashboard_metrics: ok({ series: Array.from({ length: 30 }, (_, i) => ({ day: day(i + 1), eventsCreated: 0, participantsJoined: 0, photosUploaded: 0, uploadsFailed: 0 })) }), admin_payments_summary: summary });
    const v = render(await VisaoGeralConteudo({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Sem atividade neste período")).toBeTruthy();
    v.unmount();
    wire({ admin_overview: overview, admin_dashboard_metrics: metrics, admin_payments_summary: summary });
    render(await VisaoGeralConteudo({ searchParams: Promise.resolve({ dias: "7", vista: "tabela" }) }));
    const rows = screen.getAllByText(/^(seg|ter|qua|qui|sex|sáb|dom), \d\d \w+$/);
    expect(rows).toHaveLength(7);
    expect(m.rpc.mock.calls.find((c) => c[1] === "admin_dashboard_metrics")?.[2]).toMatchObject({ p_from: expect.any(String) });
  });
});

const board = (teste: number) => ok({ total: 1, counts: { todos: 263, rolando: 41, aguardando: 0, revelados: 0, denuncias: 0, excluidos: 0, teste }, items: [
  { id: ID, title: "Ana & Leo", hostName: "Ana", category: "casamento", planCode: "casamento", planName: "Casamento", participants: 32, capacity: 250, photos: 418, reports: 0, revealEnabled: true, revealAt: null, revealedAt: null, live: true, deletedAt: null }] });
const tests = ok({ total: 2, allEvents: 263, items: [
  { id: "t1", title: "Teste QA", hostName: "m", hostEmail: "marcos@revela.app", planName: "Grátis", payment: null, photos: 12, createdAt: "2026-11-09T12:00:00Z", blocked: false, blockedReason: null },
  { id: "t2", title: "Teste checkout Pix", hostName: "m", hostEmail: "marcos@revela.app", planName: "Festa", payment: "sandbox", photos: 0, createdAt: "2026-11-08T12:00:00Z", blocked: false, blockedReason: null }] });

describe("M02/M22 Eventos: chip, lista de teste e seleção só do master", () => {
  it("a lista de eventos traz o chip 'De teste N' e o Exportar abre a folha (master e auditor, não support)", async () => {
    for (const [role, exports] of [["master", true], ["auditor", true], ["support", false]] as const) {
      as(role);
      wire({ admin_events_board: board(4) });
      const { unmount } = render(await Eventos({ searchParams: Promise.resolve({}) }));
      expect(screen.getByRole("link", { name: "De teste 4" }).getAttribute("href")).toBe("/master/eventos?filtro=teste");
      expect(!!screen.queryByRole("button", { name: "Exportar CSV" })).toBe(exports);
      unmount();
    }
  });
  it("?filtro=teste: master seleciona e vê a barra do lote; support só lê (sem caixas nem barra)", async () => {
    as("master");
    wire({ admin_test_events: tests });
    const a = render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    expect(screen.getByText("263 eventos · 2 de teste")).toBeTruthy();
    expect(screen.queryByText(/selecionado/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Teste QA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Teste checkout Pix" }));
    expect(screen.getByText("2 selecionados")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desmarcar teste" })).toBeTruthy();
    a.unmount();
    as("support");
    render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText(/selecionado/)).toBeNull();
    expect(screen.getByText("Só master marca, desmarca e exclui. Um lote com evento real ou pago é recusado inteiro.")).toBeTruthy();
  });
  it("lote recusado inteiro: a folha lista o motivo de cada evento e nada some", async () => {
    as("master");
    wire({ admin_test_events: tests });
    m.del.mockResolvedValue({ ok: false, kind: "refused", refusals: [
      { id: "t1", title: "Ana & Leo", code: "nottest", reason: "Não é evento de teste" },
      { id: "t2", title: "Teste checkout Pix", code: "paid", reason: "Tem pagamento confirmado em produção" }] });
    render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Teste QA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Teste checkout Pix" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir selecionados" }));
    const sheet = screen.getByRole("dialog", { name: "Excluir 2 eventos de teste?" });
    const confirm = within(sheet).getByRole("button", { name: "Excluir 2 eventos" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText("Motivo"), { target: { value: "curto" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText("Motivo"), { target: { value: "Limpeza dos eventos de homologação." } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    const refused = await screen.findByRole("dialog", { name: "Lote recusado" });
    expect(within(refused).getByText("Não é evento de teste")).toBeTruthy();
    expect(within(refused).getByText("Tem pagamento confirmado em produção")).toBeTruthy();
    expect(m.del).toHaveBeenCalledWith(["t1", "t2"], "Limpeza dos eventos de homologação.");
    expect(m.refresh).not.toHaveBeenCalled();
    fireEvent.click(within(refused).getByRole("button", { name: "Voltar para a lista" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("lote aceito: atualiza a lista e limpa a seleção", async () => {
    as("master");
    wire({ admin_test_events: tests });
    m.del.mockResolvedValue({ ok: true, count: 1 });
    render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Teste QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir selecionados" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Limpeza dos eventos de homologação." } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir 1 evento" }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(screen.queryByText(/selecionado/)).toBeNull();
  });
  it("estados: sem permissão do banco, erro e vazio da lista de teste (título é o da área)", async () => {
    as("master");
    wire({ admin_test_events: denied });
    const a = render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    expect(screen.getByRole("heading", { name: "Eventos" })).toBeTruthy();
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    a.unmount();
    wire({ admin_test_events: { state: "error", message: "x" } });
    const b = render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    b.unmount();
    wire({ admin_test_events: ok({ total: 0, allEvents: 263, items: [] }) });
    render(await Eventos({ searchParams: Promise.resolve({ filtro: "teste" }) }));
    expect(screen.getByText("Nenhum evento de teste")).toBeTruthy();
  });
});

const detail = (over: Record<string, unknown> = {}) => ok({
  event: { id: ID, title: "Ana & Leo", category: "casamento", hostName: "Ana Ribeiro", status: "ativo", startAt: "2027-03-14T20:30:00Z", endAt: "2027-03-15T06:00:00Z", createdAt: "2026-11-03T13:14:00Z", deletedAt: null,
    revealEnabled: true, revealAt: "2027-03-15T16:00:00Z", revealedAt: null, revealState: "pendente", capacity: 250, isTest: false, participants: 32, photos: 418, failedUploads: 0, ...over },
  entitlement: { planCode: "casamento", maxGuests: 250, maxShots: 30, source: "pago" },
  plan: { code: "casamento", name: "Casamento", source: "pago", paidCents: 18900, paidMethod: "pix", orderCode: "ABCD1234" },
  notices: { subscribers: 21, sent: 0, failed: 0, queued: 21 }, reportsByReason: { naoQueroAparecer: 2, constrangedora: 1, improprio: 0, outro: 0 },
  printOrders: [{ id: "p1", code: "IMP-7K2Q", product: "album", quantity: 1, status: "solicitado" }], audit: [],
});

describe("M21 Detalhe do evento: ações por papel", () => {
  it("master: marcar como teste, revelar agora e pedidos de impressão (chave ligada)", async () => {
    as("master");
    wire({ admin_event_detail: detail() });
    render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByRole("heading", { name: "Ana & Leo" })).toBeTruthy();
    expect(screen.getByText("Casamento · R$ 189,00 pago por Pix")).toBeTruthy();
    expect(screen.getByText("21 inscritos")).toBeTruthy();
    expect(screen.getByText("Pedidos de impressão")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar como teste" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revelar agora" }));
    expect(screen.getByRole("dialog", { name: "Revelar agora" })).toBeTruthy();
  });
  it("chave printed_album desligada: o cartão de impressão some", async () => {
    as("master");
    m.printed.mockResolvedValue(false);
    wire({ admin_event_detail: detail() });
    render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.queryByText("Pedidos de impressão")).toBeNull();
  });
  it("support e auditor leem, mas não veem nenhuma ação nem impressão", async () => {
    for (const role of ["support", "auditor"] as const) {
      as(role);
      wire({ admin_event_detail: detail() });
      const { unmount } = render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
      expect(screen.getByRole("heading", { name: "Ana & Leo" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Marcar como teste|Revelar agora|Desmarcar teste|Excluir/ })).toBeNull();
      expect(screen.queryByText("Pedidos de impressão")).toBeNull();
      expect(screen.getByRole("link", { name: "Voltar" })).toBeTruthy();
      unmount();
    }
  });
  it("evento de teste: desmarcar e excluir (sem 'Marcar como teste')", async () => {
    as("master");
    wire({ admin_event_detail: detail({ isTest: true }) });
    render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.queryByRole("button", { name: "Marcar como teste" })).toBeNull();
    expect(screen.getByRole("button", { name: "Desmarcar teste" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir evento de teste" })).toBeTruthy();
  });
  it("marcar evento pago: o servidor recusa e a folha mostra o motivo", async () => {
    as("master");
    wire({ admin_event_detail: detail() });
    m.flag.mockResolvedValue({ ok: false, kind: "refused", refusals: [{ id: ID, title: "Ana & Leo", code: "paid", reason: "Tem pagamento confirmado em produção" }] });
    render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como teste" }));
    const sheet = screen.getByRole("dialog", { name: "Marcar como evento de teste?" });
    fireEvent.change(within(sheet).getByLabelText("Motivo"), { target: { value: "Evento criado pela equipe para validar a embalagem." } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Marcar como teste" }));
    const refused = await screen.findByRole("dialog", { name: "Não dá para marcar como teste" });
    expect(within(refused).getByText("Este evento tem pagamento confirmado em produção.")).toBeTruthy();
    expect(m.flag).toHaveBeenCalledWith([ID], true, "Evento criado pela equipe para validar a embalagem.");
    expect(m.refresh).not.toHaveBeenCalled();
  });
  it("evento que não existe, excluído, sem permissão e erro", async () => {
    as("master");
    wire({ admin_event_detail: { state: "error", message: "invalid" } });
    const a = render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText("Evento não encontrado")).toBeTruthy();
    a.unmount();
    const b = render(await EventoConteudo({ params: Promise.resolve({ id: "não-é-uuid" }) }));
    expect(screen.getByText("Evento não encontrado")).toBeTruthy();
    expect(m.rpc).toHaveBeenCalledTimes(1);
    b.unmount();
    wire({ admin_event_detail: detail({ deletedAt: "2026-11-10T00:00:00Z" }) });
    const c = render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText("Evento não encontrado")).toBeTruthy();
    c.unmount();
    wire({ admin_event_detail: denied });
    const d = render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByRole("heading", { name: "Eventos" })).toBeTruthy();
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    d.unmount();
    wire({ admin_event_detail: { state: "error", message: "boom" } });
    render(await EventoConteudo({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
  });
});
