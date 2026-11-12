import { describe, expect, it } from "vitest";
import { accountKind, contaRows, filtersText, fullStamp, inviteRows, organizerRows, parseAba, teamErrorText, teamRows, validFilter } from "./people";

describe("pessoas: formatação e mapeamento", () => {
  it("aba desconhecida cai em Contas", () => { expect(parseAba("x")).toBe("contas"); expect(parseAba("equipe")).toBe("equipe"); });
  it("data com hora no fuso de Cuiabá", () => { expect(fullStamp("2027-03-15T06:00:00Z")).toBe("15 mar 2027 02:00"); expect(fullStamp(null)).toBe("—"); });
  it("tipo da conta", () => {
    expect(accountKind("google", false).label).toBe("Google");
    expect(accountKind("email", false).label).toBe("E-mail");
    expect(accountKind("anonymous", true).label).toBe("Convidado");
  });
  it("conta: id curto e e-mail como veio do servidor (já mascarado)", () => {
    const [r] = contaRows([{ userId: "3f9a1c2e-0000", isAnonymous: false, provider: "google", email: "m***@revela.app", createdAt: "2026-09-02T15:00:00Z", lastSignInAt: null, platformRole: "support" }]);
    expect(r).toMatchObject({ id: "3f9a1c2e", email: "m***@revela.app", last: "—", role: "support" });
  });
  it("gasto total: nulo (não master) vira traço; zero vira R$ 0,00", () => {
    const base = { userId: "u", displayName: "A", email: null, provider: "google", eventsCount: 1, activeEvents: 0, photos: 1200, lastEventAt: null, deletionRequested: true };
    expect(organizerRows([{ ...base, spendCents: null }])[0]).toMatchObject({ spend: "—", photos: "1.200", deletion: true, email: "—" });
    expect(organizerRows([{ ...base, spendCents: 0 }])[0].spend).toBe("R$ 0,00");
    expect(organizerRows([{ ...base, spendCents: 18900 }])[0].spend).toBe("R$ 189,00");
  });
  it("convite: usos e limite; a linha não tem token", () => {
    const [r] = inviteRows([{ eventTitle: "E", label: "Geral", uses: 14, maxUses: null, expiresAt: null, state: "ativo" }]);
    expect(r.uses).toBe("14 / sem limite");
    expect(JSON.stringify(r)).not.toMatch(/token|hash/i);
  });
  it("equipe: instalação quando ninguém concedeu", () => {
    expect(teamRows([{ userId: "u", email: "a@b.c", role: "master", grantedAt: "2026-09-02T14:00:00Z", grantedByEmail: null, installation: true, lastMaster: true }])[0]).toMatchObject({ by: "instalação", lastMaster: true });
  });
  it("filtro da URL só vale se for da aba", () => {
    expect(validFilter("contas", "google")).toBe("google");
    expect(validFilter("contas", "ativos")).toBeUndefined();
    expect(validFilter("convites", "revogados")).toBe("revogados");
    expect(validFilter("organizadores", "google")).toBeUndefined();
  });
  it("texto de filtros da exportação", () => {
    expect(filtersText("contas", undefined, undefined)).toBe("Nenhum filtro");
    expect(filtersText("convidados", "bloqueados", "ana")).toBe("Situação: Bloqueados · Busca: ana");
  });
  it("erros do servidor em português", () => {
    expect(teamErrorText("MM009", "x")).toMatch(/último/);
    expect(teamErrorText("MM011", "reasonrequired")).toMatch(/10 a 500/);
    expect(teamErrorText("MM005", "notfound")).toMatch(/já ter conta/);
    expect(teamErrorText("MM005", "duplicate")).toMatch(/já tem/);
    expect(teamErrorText("MM004", "forbidden")).toMatch(/permissão/);
  });
});
