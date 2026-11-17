import { describe, expect, it } from "vitest";
import { decideConsoleAccess, decideMasterAccess } from "./access";
import { canOpen, ROLE_MATRIX, visibleNav, whoCanOpen } from "./roles";
import { MASTER_NAV, MASTER_NAV_APP } from "@/revela/master-icons";

const u = (role?: string) => ({ is_anonymous: false, app_metadata: role ? { role } : {} });
describe("decideConsoleAccess: permissão por papel", () => {
  it("sem Supabase não há console: modo local", () => {
    expect(decideConsoleAccess({ backend: "local", user: u("master"), rpcRole: "master" }).access).toBe("local");
    expect(decideConsoleAccess({ backend: "misconfigured", user: u("master"), rpcRole: "master" }).access).toBe("local");
  });
  it("sem sessão ou com sessão anônima pede login", () => {
    expect(decideConsoleAccess({ backend: "supabase", user: null, rpcRole: null }).access).toBe("anonymous");
    expect(decideConsoleAccess({ backend: "supabase", user: { is_anonymous: true, app_metadata: {} }, rpcRole: "master" }).access).toBe("anonymous");
  });
  it.each(["master", "support", "auditor"] as const)("%s com claim e linha ativa entra, com o próprio papel", (role) => {
    expect(decideConsoleAccess({ backend: "supabase", user: u(role), rpcRole: role })).toEqual({ access: "ok", role });
  });
  it("sem papel (organizador comum) é negado, mesmo que a RPC devolva um papel por engano", () => {
    expect(decideConsoleAccess({ backend: "supabase", user: u("host"), rpcRole: "master" })).toEqual({ access: "forbidden", role: null });
    expect(decideConsoleAccess({ backend: "supabase", user: u(), rpcRole: null }).access).toBe("forbidden");
    expect(decideConsoleAccess({ backend: "supabase", user: u(), rpcRole: "master" }).access).toBe("forbidden");
  });
  it("claim sem linha ativa (RPC nula) ou com outro papel é negado", () => {
    expect(decideConsoleAccess({ backend: "supabase", user: u("support"), rpcRole: null }).access).toBe("forbidden");
    expect(decideConsoleAccess({ backend: "supabase", user: u("master"), rpcRole: "support" }).access).toBe("forbidden");
    expect(decideConsoleAccess({ backend: "supabase", user: u("support"), rpcRole: "master" }).access).toBe("forbidden");
  });
  it("decideMasterAccess devolve só o veredito", () => {
    expect(decideMasterAccess({ backend: "supabase", user: u("auditor"), rpcRole: "auditor" })).toBe("ok");
  });
});

describe("papéis × áreas do menu", () => {
  it("master abre tudo; Impressões só com a chave ligada", () => {
    expect(visibleNav("master", { printedAlbum: true })).toHaveLength(14);
    const off = visibleNav("master", { printedAlbum: false });
    expect(off).toHaveLength(13);
    expect(off).not.toContain("impressoes");
  });
  it("support não vê Planos, Pagamentos, Cortesias, Impressões, Auditoria nem Configurações", () => {
    const nav = visibleNav("support", { printedAlbum: true });
    for (const a of ["planos", "pagamentos", "cortesias", "impressoes", "auditoria", "configuracoes"] as const) expect(nav).not.toContain(a);
    expect(nav).toEqual(["visao", "acessos", "eventos", "pessoas", "revelacoes", "moderacao", "saude", "lgpd"]);
  });
  it("auditor vê Auditoria, mas não Pagamentos nem Configurações", () => {
    const nav = visibleNav("auditor", { printedAlbum: true });
    expect(nav).toContain("auditoria");
    expect(nav).not.toContain("pagamentos");
    expect(canOpen("auditor", "configuracoes")).toBe(false);
    expect(canOpen("auditor", "auditoria")).toBe(true);
  });
  it("sem papel não abre nada", () => {
    expect(visibleNav(null, { printedAlbum: true })).toEqual([]);
    expect(canOpen(null, "visao")).toBe(false);
  });
  it("a legenda da M32 diz quem abre a área", () => {
    expect(whoCanOpen("planos")).toBe("Esta área é só para master");
    expect(whoCanOpen("auditoria")).toBe("Esta área é só para master e auditor");
  });
  it("a matriz mostrada é a real: support e auditor não leem Pagamentos e só o auditor audita e exporta", () => {
    const row = (l: string) => ROLE_MATRIX.find((r) => r.label === l)!;
    expect(row("Pagamentos")).toMatchObject({ master: "yes", support: "no", auditor: "no" });
    expect(row("Auditoria")).toMatchObject({ support: "no", auditor: "yes" });
    expect(row("Exportar")).toMatchObject({ support: "no", auditor: "yes" });
    expect(row("E-mail e contato completos")).toMatchObject({ support: "masked", auditor: "masked" });
  });
});

describe("menu do app × desenho de referência", () => {
  it("o desenho segue com os 13 itens; o app encaixa Acessos logo depois de Visão geral", () => {
    expect(MASTER_NAV).toHaveLength(13);
    expect(MASTER_NAV_APP).toHaveLength(14);
    expect(MASTER_NAV_APP.slice(0, 3).map((n) => n.id)).toEqual(["visao", "acessos", "eventos"]);
  });
  it("support e auditor abrem Acessos (só leitura, números agregados)", () => {
    for (const r of ["master", "support", "auditor"] as const) expect(canOpen(r, "acessos")).toBe(true);
    expect(canOpen(null, "acessos")).toBe(false);
  });
});
