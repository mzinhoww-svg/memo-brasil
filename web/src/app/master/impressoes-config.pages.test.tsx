// @vitest-environment jsdom
/* Rotas e ações de Impressões (M29/M30) e Configurações (M31): permissão por papel, 404 sem a chave `printed_album` e o que cada ação manda ao servidor. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformRole } from "@/lib/master/access";

const m = vi.hoisted(() => ({ session: vi.fn(), printed: vi.fn(), refresh: vi.fn(), serverRpc: vi.fn(), browserRpc: vi.fn() }));
// data.tsx importa "server-only" (pacote que só o Next resolve): aqui entram as guardas reais (gate.tsx) e um `rpc` igual ao dele.
vi.mock("./data", async () => {
  const gate = await import("./gate");
  type Sb = { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { code?: string; message: string } | null }> };
  const rpc = async (sb: Sb, name: string, args?: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(name, args ?? {});
    if (!error) return { state: "ok", data };
    if (error.code === "MM004" || /forbidden/i.test(error.message)) return { state: "denied" };
    return { state: "error", message: error.message };
  };
  return { ...gate, rpc };
});
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/lib/master/server", () => ({ masterAccess: m.session, printedAlbumOn: m.printed }));
vi.mock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc: m.browserRpc }) }));
import Configuracoes from "./configuracoes/page";
import Impressoes from "./impressoes/page";
import ImpressaoDetalhe from "./impressoes/[id]/page";

const ID = "00000000-0000-4000-8000-000000036b01";
const as = (role: PlatformRole | null, access: "ok" | "forbidden" | "anonymous" | "local" = role ? "ok" : "forbidden") =>
  m.session.mockResolvedValue({ access, role, sb: access === "ok" ? { rpc: m.serverRpc } : null, user: { name: "x" } });
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });
const board = { total: 14, counts: { todos: 14, solicitado: 4, em_producao: 3, enviado: 2, entregue: 4, cancelado: 1 }, items: [
  { id: ID, code: "IMP-7K2Q", eventTitle: "Ana & Leo", product: "album", quantity: 1, photoCount: 48, allPhotos: false, contactName: "Ana Ribeiro", requesterKind: "anfitriao", status: "solicitado", createdAt: "2026-11-12T12:12:00Z" },
] };
const detail = (status: string) => ({ id: ID, code: "IMP-7K2Q", status, product: "album", quantity: 2, eventTitle: "Ana & Leo", requesterKind: "anfitriao", contactName: "Ana Ribeiro", contactPhone: "65998124077",
  contactEmail: "ana@email.com", shipping: { street: "Rua A", number: "1", neighborhood: "Centro", city: "Cuiabá", state: "MT", cep: "78000000" }, note: null, photoCount: 48, photoNums: [3, 7, 12], noteInternal: "Conferir o papel",
  createdAt: "2026-11-12T12:12:00Z", history: [{ status: "solicitado", at: "2026-11-12T12:12:00Z", by: "Ana Ribeiro" }] });
const overview = { paymentsEnv: "production", flags: { validapay_checkout: true, validapay_card: false, printed_album: false },
  settings: { pixMinutes: 15, supportEmail: "suporte@revela.app", supportPhone: null, companyLegalName: null, companyCnpj: null, capacityGracePct: 10 }, webhook: { lastAt: null, pending: 0, failing: 0 } };

beforeEach(() => { for (const f of [m.session, m.printed, m.refresh, m.serverRpc, m.browserRpc]) f.mockReset(); m.printed.mockResolvedValue(true); m.browserRpc.mockResolvedValue({ error: null }); });
afterEach(cleanup);
const show = async (page: Promise<React.ReactNode>) => { render(<>{await page}</>); };

describe("permissão por papel em cada rota", () => {
  it("sem a chave printed_album: a lista e o detalhe respondem 404, até para o master", async () => {
    as("master");
    m.printed.mockResolvedValue(false);
    await expect(Impressoes(sp())).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(ImpressaoDetalhe({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.serverRpc).not.toHaveBeenCalled();
  });
  it("support e auditor: M32 (acesso limitado) nas três rotas, sem nenhuma chamada ao banco", async () => {
    for (const role of ["support", "auditor"] as const) {
      as(role);
      for (const page of [Impressoes(sp()), ImpressaoDetalhe({ params: Promise.resolve({ id: ID }) }), Configuracoes()]) {
        await show(page);
        expect(screen.getByRole("heading", { name: "Acesso limitado" })).toBeTruthy();
        expect(screen.getByText("Esta área é só para master")).toBeTruthy();
        cleanup();
      }
    }
    expect(m.serverRpc).not.toHaveBeenCalled();
  });
  it("conta sem papel, anônimo e modo local: 404 nas três rotas", async () => {
    for (const [role, access] of [[null, "forbidden"], [null, "anonymous"], [null, "local"]] as const) {
      as(role, access);
      await expect(Impressoes(sp())).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(ImpressaoDetalhe({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("NEXT_NOT_FOUND");
      await expect(Configuracoes()).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
  it("o banco recusa (MM004) mesmo com papel: estado 'Sem permissão', com o nome da área no título", async () => {
    as("master");
    m.serverRpc.mockResolvedValue({ data: null, error: { code: "MM004", message: "forbidden" } });
    for (const page of [Impressoes(sp()), ImpressaoDetalhe({ params: Promise.resolve({ id: ID }) }), Configuracoes()]) {
      await show(page);
      expect(screen.getByText("Sem permissão para ver estes dados.")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^(Impressões|Configurações)$/);
      cleanup();
    }
  });
});

describe("M29 · lista", () => {
  it("mostra os pedidos, os chips com contagem e a linha abre o detalhe", async () => {
    as("master");
    m.serverRpc.mockResolvedValue({ data: board, error: null });
    await show(Impressoes(sp({ f: "solicitado", q: "ana", p: "1" })));
    expect(m.serverRpc).toHaveBeenCalledWith("admin_print_orders", { p_filter: "solicitado", p_search: "ana", p_limit: 25, p_offset: 0 });
    expect(screen.getByText("Todos 14")).toBeTruthy();
    expect(screen.getByText("Solicitado 4").className).toContain("on");
    expect(screen.getByRole("link", { name: "Abrir o pedido IMP-7K2Q" }).getAttribute("href")).toBe(`/master/impressoes/${ID}`);
    expect(screen.getByText("Ana Ribeiro · anfitrião")).toBeTruthy();
    expect(screen.getByText("1–1 de 14 · 25 por página")).toBeTruthy();
  });
  it("filtro inválido na URL é ignorado; página 2 pede o deslocamento certo", async () => {
    as("master");
    m.serverRpc.mockResolvedValue({ data: board, error: null });
    await show(Impressoes(sp({ f: "xx", p: "2" })));
    expect(m.serverRpc).toHaveBeenCalledWith("admin_print_orders", { p_filter: null, p_search: null, p_limit: 25, p_offset: 25 });
  });
  it("quatro estados: vazio, vazio do filtro, erro e sem permissão", async () => {
    as("master");
    m.serverRpc.mockResolvedValueOnce({ data: { total: 0, counts: { todos: 0 }, items: [] }, error: null });
    await show(Impressoes(sp()));
    expect(screen.getByText("Nenhum pedido de impressão")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
    cleanup();
    m.serverRpc.mockResolvedValueOnce({ data: { total: 0, counts: { todos: 14, solicitado: 0 }, items: [] }, error: null });
    await show(Impressoes(sp({ f: "solicitado" })));
    expect(screen.getByText("Nenhum pedido neste filtro")).toBeTruthy();
    cleanup();
    m.serverRpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    await show(Impressoes(sp()));
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
  });
});

describe("M30 · detalhe e ações", () => {
  const open = async (status: string) => { as("master"); m.serverRpc.mockResolvedValue({ data: detail(status), error: null }); await show(ImpressaoDetalhe({ params: Promise.resolve({ id: ID }) })); };
  it("id que não é UUID ou pedido que não existe: 'Pedido não encontrado' (sem chamar o banco no primeiro caso)", async () => {
    as("master");
    await show(ImpressaoDetalhe({ params: Promise.resolve({ id: "abc" }) }));
    expect(screen.getByText("Pedido não encontrado")).toBeTruthy();
    expect(m.serverRpc).not.toHaveBeenCalled();
    cleanup();
    m.serverRpc.mockResolvedValue({ data: null, error: null });
    await show(ImpressaoDetalhe({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText("Pedido não encontrado")).toBeTruthy();
  });
  it("mostra contato, fotos só como números e a nota interna", async () => {
    await open("solicitado");
    expect(screen.getByRole("heading", { name: "Pedido IMP-7K2Q" })).toBeTruthy();
    expect(screen.getByText("(65) 99812-4077")).toBeTruthy();
    expect(screen.getByText(/48 fotos\./)).toBeTruthy();
    expect(screen.getByText("+45")).toBeTruthy();
    expect(document.querySelector(".nums img")).toBeNull();
    expect((screen.getByLabelText("Nota interna") as HTMLTextAreaElement).value).toBe("Conferir o papel");
  });
  it("botões por status: só o passo seguinte, e cancelar só até o envio", async () => {
    const labels = async (status: string) => { await open(status); const l = [...document.querySelectorAll("button, a.rv-btn")].map((b) => b.textContent); cleanup(); return l; };
    expect(await labels("solicitado")).toEqual(expect.arrayContaining(["Cancelar pedido", "Marcar em produção"]));
    expect(await labels("em_producao")).toEqual(expect.arrayContaining(["Cancelar pedido", "Marcar enviado"]));
    const enviado = await labels("enviado");
    expect(enviado).toContain("Marcar entregue");
    expect(enviado).not.toContain("Cancelar pedido");
    for (const final of ["entregue", "cancelado"]) {
      const l = await labels(final);
      expect(l.filter((x) => /Marcar|Cancelar pedido/.test(x ?? ""))).toEqual([]);
    }
  });
  it("avançar: folha M30.f1, chama a RPC com o próximo status e recarrega", async () => {
    await open("solicitado");
    fireEvent.click(screen.getByRole("button", { name: "Marcar em produção" }));
    expect(screen.getByRole("dialog", { name: "Marcar como em produção?" })).toBeTruthy();
    fireEvent.click(within("dialog").getByRole("button", { name: "Marcar em produção" }));
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_set_print_order_status", { p_id: ID, p_status: "em_producao", p_note: null }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
  });
  it("avançar: pedido que já mudou mostra a mensagem e não recarrega", async () => {
    await open("solicitado");
    m.browserRpc.mockResolvedValue({ error: { code: "MM009", message: "estado" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar em produção" }));
    fireEvent.click(within("dialog").getByRole("button", { name: "Marcar em produção" }));
    expect((await screen.findByRole("alert")).textContent).toContain("O pedido já mudou de estado");
    expect(m.refresh).not.toHaveBeenCalled();
  });
  it("cancelar: pede motivo (10 a 500), manda o motivo e não há como desfazer", async () => {
    await open("em_producao");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    const dlg = within("dialog");
    expect(dlg.getByText("Não dá para reabrir um pedido cancelado.")).toBeTruthy();
    const confirm = dlg.getByRole("button", { name: "Cancelar pedido" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(dlg.getByLabelText("Motivo"), { target: { value: "curto" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(dlg.getByLabelText("Motivo"), { target: { value: "Pediu o cancelamento por telefone" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_set_print_order_status", { p_id: ID, p_status: "cancelado", p_note: "Pediu o cancelamento por telefone" }));
  });
  it("nota interna: salva ao sair do campo, só se mudou", async () => {
    await open("solicitado");
    const box = screen.getByLabelText("Nota interna");
    fireEvent.blur(box);
    expect(m.browserRpc).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "Arte aprovada" } });
    fireEvent.blur(box);
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_set_print_order_note", { p_id: ID, p_note: "Arte aprovada" }));
  });
});

describe("M31 · configurações", () => {
  const open = async () => { as("master"); m.serverRpc.mockResolvedValue({ data: overview, error: null }); await show(Configuracoes()); };
  it("ambiente do pagamento é só leitura; cartão e checkout são chaves; validade, suporte, empresa e folga têm 'Alterar'", async () => {
    await open();
    const row = screen.getByText("Ambiente do pagamento").closest(".rv-row")!;
    expect(row.querySelector("button")).toBeNull();
    expect(row.querySelector(".rv-toggle")).toBeNull();
    expect(screen.getByText("Produção")).toBeTruthy();
    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label"))).toEqual(["Checkout ligado", "Cartão ligado", "Álbum impresso"]);
    expect(screen.getAllByRole("button", { name: /^Alterar / })).toHaveLength(6);
    expect(screen.getByText("Chave validapay_card. Exige confirmação do banco (3DS).")).toBeTruthy();
  });
  it("desligar o checkout abre a folha M31.f2 e grava a chave com o motivo", async () => {
    await open();
    fireEvent.click(screen.getByRole("switch", { name: "Checkout ligado" }));
    expect(screen.getByRole("dialog", { name: "Desligar o checkout?" })).toBeTruthy();
    fireEvent.change(within("dialog").getByLabelText("Motivo"), { target: { value: "Instabilidade na ValidaPay; religar depois." } });
    fireEvent.click(within("dialog").getByRole("button", { name: "Desligar checkout" }));
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_set_feature_flag", { p_key: "validapay_checkout", p_enabled: false, p_rollout: {}, p_reason: "Instabilidade na ValidaPay; religar depois." }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
  });
  it("ligar o álbum impresso grava printed_album = true", async () => {
    await open();
    fireEvent.click(screen.getByRole("switch", { name: "Álbum impresso" }));
    fireEvent.change(within("dialog").getByLabelText("Motivo"), { target: { value: "Liberar o piloto de álbum impresso" } });
    fireEvent.click(within("dialog").getByRole("button", { name: "Ligar álbum impresso" }));
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_set_feature_flag", expect.objectContaining({ p_key: "printed_album", p_enabled: true })));
  });
  it("validade do Pix: fora de 5 a 1.440 não é enviada; dentro, vai como número com valor antigo e motivo", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Alterar validade do Pix" }));
    const dlg = within("dialog");
    expect(dlg.getByText("15 min")).toBeTruthy();
    fireEvent.change(dlg.getByLabelText("Motivo"), { target: { value: "Anfitriões relataram pouco tempo" } });
    for (const bad of ["4", "1441", "x"]) {
      fireEvent.change(dlg.getByLabelText("Minutos"), { target: { value: bad } });
      expect(dlg.getByRole("alert").textContent).toContain("5 a 1.440");
      await waitFor(() => dlg.getByRole("button", { name: "Salvar" }));
      fireEvent.click(dlg.getByRole("button", { name: "Salvar" }));
      await Promise.resolve();
    }
    await waitFor(() => dlg.getByRole("button", { name: "Salvar" }));
    expect(m.browserRpc).not.toHaveBeenCalled();
    fireEvent.change(dlg.getByLabelText("Minutos"), { target: { value: "30" } });
    fireEvent.click(dlg.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(m.browserRpc).toHaveBeenCalledWith("admin_set_setting", { p_key: "validapay_pix_expiry_minutes", p_value: 30, p_reason: "Anfitriões relataram pouco tempo" }));
  });
  it("erro do servidor aparece na folha e a folha continua aberta", async () => {
    await open();
    m.browserRpc.mockResolvedValue({ error: { code: "MM011", message: "reasonrequired" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar e-mail do suporte" }));
    fireEvent.change(within("dialog").getByLabelText("Motivo"), { target: { value: "E-mail oficial do suporte" } });
    fireEvent.click(within("dialog").getByRole("button", { name: "Salvar" }));
    expect((await within("dialog").findByRole("alert")).textContent).toContain("10 a 500");
    expect(m.refresh).not.toHaveBeenCalled();
  });
});

function within(role: string) {
  const el = screen.getByRole(role);
  return { getByRole: (r: string, o?: { name: string | RegExp }) => getInside(el, r, o), getByLabelText: (t: string) => getByLabel(el, t), getByText: (t: string) => getByText(el, t), findByRole: async (r: string) => { await waitFor(() => getInside(el, r)); return getInside(el, r); } };
}
function getInside(el: HTMLElement, role: string, o?: { name: string | RegExp }): HTMLElement {
  const sel = role === "button" ? "button" : role === "alert" ? "[role=alert]" : `[role=${role}]`;
  const found = [...el.querySelectorAll<HTMLElement>(sel)].filter((x) => !o || (typeof o.name === "string" ? x.textContent === o.name || x.getAttribute("aria-label") === o.name : o.name.test(x.textContent ?? "")));
  if (!found.length) throw new Error(`não achei ${role} ${o?.name ?? ""}`);
  return found[0];
}
function getByLabel(el: HTMLElement, t: string): HTMLElement {
  const x = el.querySelector<HTMLElement>(`[aria-label="${t}"]`);
  if (!x) throw new Error(`não achei o campo ${t}`);
  return x;
}
function getByText(el: HTMLElement, t: string): HTMLElement {
  const x = [...el.querySelectorAll<HTMLElement>("*")].find((n) => n.children.length === 0 && n.textContent === t);
  if (!x) throw new Error(`não achei o texto ${t}`);
  return x;
}
