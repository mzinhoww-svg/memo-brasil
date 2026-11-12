// @vitest-environment jsdom
/* Permissão por papel em cada rota e ação do grupo "Revelações e moderação + Saúde e auditoria" (M08, M26, M27, M28):
   master, support, auditor e sem papel; a fila de moderação não traz foto nem denunciante; as ações pedem motivo. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRole } from "@/lib/master/access";

const m = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), browserRpc: vi.fn(), refresh: vi.fn() }));
vi.mock("./data", async () => {
  const { requireRole } = await import("./gate");
  const rpc = async (sb: { rpc: (n: string, a?: unknown) => Promise<{ data: unknown; error: { code?: string; message: string } | null }> }, name: string, args?: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(name, args ?? {});
    if (!error) return { state: "ok", data };
    return error.code === "MM004" || /forbidden/i.test(error.message) ? { state: "denied" } : { state: "error", message: error.message };
  };
  return { requireRole, rpc, requireMaster: async () => (await (await import("@/lib/master/server")).masterAccess()).sb, num: (n: number) => String(n), bytes: (n: number) => String(n) };
});
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, useRouter: () => ({ refresh: m.refresh, push: vi.fn() }), usePathname: () => "/master" }));
vi.mock("@/lib/master/server", () => ({ masterAccess: m.session, printedAlbumOn: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc: m.browserRpc }) }));

import Moderacao from "./moderacao/page";
import Saude from "./saude/page";
import Auditoria from "./auditoria/page";
import Revelacoes from "./revelacoes/page";

const QUEUE = {
  photos: [
    { photoId: "3f1a0000-0000-4000-8000-000000000001", eventId: "e1", eventTitle: "Chá da Maria", reports: 3, hidden: false, reasons: { improprio: 2, outro: 1 } },
    { photoId: "b77e0000-0000-4000-8000-000000000002", eventId: "e2", eventTitle: "Formatura Medicina UFMT", reports: 4, hidden: true, reasons: { constrangedora: 3, improprio: 1 } },
  ],
  comments: [{ id: "c1", eventTitle: "Chá da Maria", authorName: null, body: null, reports: 1, hidden: false, hiddenBy: null, reasons: { ofensivo: 1 } }],
  blocked: [],
};
const AUDIT = { total: 26, items: [{ id: 1, at: "2026-11-11T12:51:00Z", actorId: "u1", actorRole: "master", actorEmail: "m***@revela.app", action: "plan.price_changed", targetType: "plan", targetId: "casamento", targetLabel: "Casamento", reason: "Reajuste aprovado para a temporada 2027" }] };
const HEALTH = { generatedAt: "2026-11-11T12:42:00Z", cronAvailable: true, jobs: [], reveals: { overdue: 0, maxDelaySeconds: 0 }, purgeQueue: { size: 0, oldestAgeSeconds: 0 }, uploads: { stalled: 0, failed: 0 }, lgpd: { pendingDeletions: 0 } };
const HIST = { cronAvailable: true, jobs: [{ name: "mm-reveal-due", active: true, runs: [{ startedAt: "2026-11-11T12:42:00Z", durationMs: 5, status: "succeeded" }], consecutiveFailures: 0 }] };
const STORAGE = { originals: { n: 10, bytes: 5e9 }, derived: { n: 10, bytes: 1e8 }, orphans: { n: 0, bytes: 0 }, branding: { n: 2, bytes: 1e6 }, totalBytes: 5.1e9, growth: [{ day: "2026-11-11", bytes: 1e9 }], uploads: { inProgress: 1, failed24h: 0, photosReady: 10 }, quotaBytes: null, purgeQueue: { size: 0, oldestAgeSeconds: 0 }, generatedAt: "2026-11-11T12:42:00Z" };
const REVEALS = { items: [{ id: "ev1", title: "Ana & Leo", revealAt: "2099-03-15T15:00:00Z", revealedAt: null, photos: 418, emailOptIns: 21, emailsSent: 0, emailsFailed: 0, emailsQueued: 0 }] };
const DATA: Record<string, unknown> = {
  admin_moderation_queue: QUEUE, admin_list_audit_v2: AUDIT, admin_audit_events: [{ id: "e1", title: "Chá da Maria" }], admin_health: HEALTH, admin_health_history: HIST,
  admin_storage_breakdown: STORAGE, admin_overview: { upcomingReveals: [], readiness: {} }, admin_reveals_board: REVEALS,
};

const as = (role: PlatformRole | null, access: "ok" | "forbidden" = role ? "ok" : "forbidden") => {
  m.rpc.mockImplementation(async (name: string) => ({ data: DATA[name] ?? null, error: null }));
  m.session.mockResolvedValue({ access, role, sb: access === "ok" ? { rpc: m.rpc } : null, user: { name: "x" } });
};
const open = async (ui: Promise<ReactNode>) => render(<>{await ui}</>);
const sp = <T extends object>(o: T) => Promise.resolve(o);
beforeEach(() => { m.session.mockReset(); m.rpc.mockReset(); m.browserRpc.mockReset().mockResolvedValue({ data: { ok: true }, error: null }); m.refresh.mockReset(); });
afterEach(cleanup);

describe("M26 Moderação: fila sem foto nem denunciante", () => {
  it("master vê id curto, evento, total e motivos agregados, e nenhuma imagem", async () => {
    as("master");
    const { container } = await open(Moderacao({ searchParams: sp({ aba: "fotos" }) }));
    expect(screen.getByText("foto 3f1a…")).toBeTruthy();
    expect(screen.getByText("2 Conteúdo impróprio")).toBeTruthy();
    expect(screen.getByText("1 Outro motivo")).toBeTruthy();
    expect(screen.getByText("3 Foto constrangedora")).toBeTruthy();
    expect(container.querySelectorAll("img, picture, video, canvas")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/https?:|storage|signed|denunciante|user_id|reporter/i);
    expect(screen.getByText(/Quem denunciou nunca é mostrado/)).toBeTruthy();
  });
  it("foto visível: Manter e Esconder; escondida: Manter e Excluir", async () => {
    as("master");
    await open(Moderacao({ searchParams: sp({ aba: "fotos" }) }));
    expect(screen.getAllByRole("button", { name: "Manter" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Esconder" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(1);
  });
  it("support e auditor leem a fila, mas não têm Manter, Esconder nem Excluir", async () => {
    for (const role of ["support", "auditor"] as const) {
      as(role);
      const { unmount } = await open(Moderacao({ searchParams: sp({ aba: "fotos" }) }));
      expect(screen.getByText("foto 3f1a…")).toBeTruthy();
      for (const n of ["Manter", "Esconder", "Excluir"]) expect(screen.queryByRole("button", { name: n })).toBeNull();
      unmount();
    }
  });
  it("Exportar: master e auditor; support não", async () => {
    for (const [role, has] of [["master", true], ["auditor", true], ["support", false]] as const) {
      as(role);
      const { unmount } = await open(Moderacao({ searchParams: sp({}) }));
      expect(!!screen.queryByRole("button", { name: "Exportar" })).toBe(has);
      unmount();
    }
  });
  it("comentários: o texto só vem para o master (servidor), os motivos aparecem para todos", async () => {
    as("support");
    await open(Moderacao({ searchParams: sp({ aba: "comentarios" }) }));
    expect(screen.getByText("1 Ofensivo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Comentários 1" }).getAttribute("href")).toBe("/master/moderacao?aba=comentarios");
  });
  it("sem papel: 404 e nenhuma RPC", async () => {
    as(null);
    await expect(Moderacao({ searchParams: sp({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("esconder pede motivo de 10 a 500 caracteres e chama admin_moderate_photo", async () => {
    as("master");
    await open(Moderacao({ searchParams: sp({ aba: "fotos" }) }));
    fireEvent.click(screen.getAllByRole("button", { name: "Esconder" })[0]);
    const confirm = screen.getByRole("button", { name: "Esconder foto" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    const box = screen.getByRole("textbox", { name: "Motivo" });
    fireEvent.change(box, { target: { value: "curto" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "a".repeat(501) } });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "Três denúncias, duas por conteúdo impróprio." } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_moderate_photo", { p_photo: "3f1a0000-0000-4000-8000-000000000001", p_action: "esconder", p_reason: "Três denúncias, duas por conteúdo impróprio." }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
  });
  it("comentário: Manter vira 'mostrar' e Excluir vira 'remover' no servidor", async () => {
    as("master");
    await open(Moderacao({ searchParams: sp({ aba: "comentarios" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Conferido com a anfitriã." } });
    fireEvent.click(screen.getByRole("button", { name: "Manter comentário" }));
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("moderate_comment", { p_comment: "c1", p_action: "mostrar", p_reason: "Conferido com a anfitriã." }));
  });
  it("erro do servidor aparece na folha e a folha continua aberta", async () => {
    as("master");
    m.browserRpc.mockResolvedValue({ data: null, error: { code: "MM004", message: "forbidden" } });
    await open(Moderacao({ searchParams: sp({}) }));
    fireEvent.click(screen.getAllByRole("button", { name: "Esconder" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Motivo com mais de dez." } });
    fireEvent.click(screen.getByRole("button", { name: "Esconder foto" }));
    expect(await screen.findByText("Sem permissão para esta ação.")).toBeTruthy();
  });
  it("estados: erro, sem permissão e vazio", async () => {
    as("master");
    m.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    const a = await open(Moderacao({ searchParams: sp({}) }));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Moderação" })).toBeTruthy();
    a.unmount();
    m.rpc.mockResolvedValue({ data: null, error: { code: "MM004", message: "forbidden" } });
    const b = await open(Moderacao({ searchParams: sp({}) }));
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    b.unmount();
    m.rpc.mockResolvedValue({ data: { photos: [], comments: [], blocked: [] }, error: null });
    await open(Moderacao({ searchParams: sp({}) }));
    expect(screen.getByText("Nenhuma denúncia aberta")).toBeTruthy();
    expect(screen.getByText("Quando um convidado denunciar uma foto, ela aparece aqui.")).toBeTruthy();
  });
});

describe("M27 Storage e saúde: master, support e auditor", () => {
  it("os três papéis abrem; sem papel é 404", async () => {
    for (const role of ["master", "support", "auditor"] as const) {
      as(role);
      const { unmount } = await open(Saude());
      expect(screen.getByRole("heading", { name: "Storage e saúde" })).toBeTruthy();
      expect(screen.getByText("Jobs agendados")).toBeTruthy();
      expect(screen.getByText("Revelar eventos na hora")).toBeTruthy();
      expect(screen.getByText(/Uploads em andamento/)).toBeTruthy();
      unmount();
    }
    as(null);
    await expect(Saude()).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("estados vazio, erro e sem permissão", async () => {
    as("support");
    DATA.admin_health_history = { cronAvailable: true, jobs: [{ name: "mm-reveal-due", active: true, runs: [], consecutiveFailures: 0 }] };
    DATA.admin_storage_breakdown = { ...STORAGE, totalBytes: 0 };
    const a = await open(Saude());
    expect(screen.getByText("Sem leituras ainda")).toBeTruthy();
    a.unmount();
    DATA.admin_health_history = HIST; DATA.admin_storage_breakdown = STORAGE;
    m.rpc.mockImplementation(async (name: string) => (name === "admin_health" ? { data: null, error: { code: "MM004", message: "forbidden" } } : { data: DATA[name], error: null }));
    const b = await open(Saude());
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Storage e saúde" })).toBeTruthy();
    b.unmount();
    m.rpc.mockImplementation(async (name: string) => (name === "admin_storage_breakdown" ? { data: null, error: { code: "XX000", message: "x" } } : { data: DATA[name], error: null }));
    await open(Saude());
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
  });
});

describe("M28 Auditoria: master e auditor", () => {
  it("master e auditor veem a tabela, as categorias e o botão Exportar", async () => {
    for (const role of ["master", "auditor"] as const) {
      as(role);
      const { unmount } = await open(Auditoria({ searchParams: sp({ cat: "admin" }) }));
      expect(screen.getByText("Preço de plano alterado")).toBeTruthy();
      expect(screen.getByText("m***@revela.app")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Pagamento" }).getAttribute("href")).toBe("/master/auditoria?cat=pagamento");
      expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
      expect(m.rpc).toHaveBeenCalledWith("admin_list_audit_v2", { p_limit: 25, p_offset: 0, p_category: "admin", p_event: null });
      unmount();
      m.rpc.mockClear();
    }
  });
  it("support vê o acesso limitado e nenhuma RPC da auditoria é chamada", async () => {
    as("support");
    await open(Auditoria({ searchParams: sp({}) }));
    expect(screen.getByRole("heading", { name: "Acesso limitado" })).toBeTruthy();
    expect(screen.getByText("Esta área é só para master e auditor")).toBeTruthy();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("sem papel é 404", async () => {
    as(null);
    await expect(Auditoria({ searchParams: sp({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("página e evento viram deslocamento e filtro; evento inválido é ignorado", async () => {
    as("auditor");
    const id = "11111111-1111-4111-8111-111111111111";
    await open(Auditoria({ searchParams: sp({ cat: "revelacao", evento: id, p: "2" }) }));
    expect(m.rpc).toHaveBeenCalledWith("admin_list_audit_v2", { p_limit: 25, p_offset: 25, p_category: "revelacao", p_event: id });
    cleanup();
    m.rpc.mockClear();
    await open(Auditoria({ searchParams: sp({ cat: "inventada", evento: "x'; drop" }) }));
    expect(m.rpc).toHaveBeenCalledWith("admin_list_audit_v2", { p_limit: 25, p_offset: 0, p_category: null, p_event: null });
  });
  it("estados vazio, erro e sem permissão", async () => {
    as("auditor");
    m.rpc.mockImplementation(async (n: string) => (n === "admin_list_audit_v2" ? { data: { total: 0, items: [] }, error: null } : { data: DATA[n], error: null }));
    const a = await open(Auditoria({ searchParams: sp({ cat: "pagamento" }) }));
    expect(screen.getByText("Nenhum registro neste filtro")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Admin" })).toBeTruthy();
    a.unmount();
    m.rpc.mockImplementation(async () => ({ data: null, error: { code: "MM004", message: "forbidden" } }));
    const b = await open(Auditoria({ searchParams: sp({}) }));
    expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Auditoria" })).toBeTruthy();
    b.unmount();
    m.rpc.mockImplementation(async () => ({ data: null, error: { code: "XX000", message: "x" } }));
    await open(Auditoria({ searchParams: sp({}) }));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
  });
});

describe("M08 Revelações: 'Revelar agora' é só do master, com a folha única", () => {
  it("master vê o botão e a folha única 'Manter a hora'; support e auditor leem sem o botão", async () => {
    as("master");
    const a = await open(Revelacoes());
    fireEvent.click(screen.getByRole("button", { name: /Revelar agora/ }));
    expect(screen.getByRole("button", { name: "Manter a hora" })).toBeTruthy();
    a.unmount();
    for (const role of ["support", "auditor"] as const) {
      as(role);
      const { unmount } = await open(Revelacoes());
      expect(screen.getByText("Ana & Leo")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Revelar agora/ })).toBeNull();
      unmount();
    }
    as(null);
    await expect(Revelacoes()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
