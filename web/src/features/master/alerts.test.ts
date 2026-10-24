import { describe, expect, it } from "vitest";
import { missingSettings, shellFromSignals, signalsFromLegacy, signalsFromOverview, type ShellSignals } from "./alerts";

const vazio: ShellSignals = {};

describe("shellFromSignals: alertas", () => {
  it("sem sinais não gera alertas nem badges", () => {
    expect(shellFromSignals(vazio)).toEqual({ alerts: [], badges: {} });
  });

  it("revelação atrasada é crítica e leva a Revelações", () => {
    const { alerts } = shellFromSignals({ reveals: { pending: 3, overdue: 2 } });
    expect(alerts).toEqual([expect.objectContaining({ id: "revelacoes-atrasadas", severity: "crit", title: "2 revelações atrasadas", href: "/master/revelacoes" })]);
    expect(shellFromSignals({ reveals: { pending: 1, overdue: 1 } }).alerts[0].title).toBe("1 revelação atrasada");
  });

  it("revelações só pendentes não geram alerta", () => {
    expect(shellFromSignals({ reveals: { pending: 4, overdue: 0 } }).alerts).toEqual([]);
  });

  it("rotina falhando é crítica, cita os nomes e leva a Saúde", () => {
    const { alerts } = shellFromSignals({ jobs: { total: 4, failing: ["mm-reveal", "mm-purge"] } });
    expect(alerts[0]).toMatchObject({ severity: "crit", title: "2 rotinas falhando", href: "/master/saude" });
    expect(alerts[0].text).toContain("mm-reveal, mm-purge");
  });

  it("LGPD atrasada é crítica; só pendente é informativo", () => {
    expect(shellFromSignals({ lgpd: { pending: 3, overdue: 1 } }).alerts).toEqual([expect.objectContaining({ severity: "crit", title: "1 solicitação LGPD atrasada", href: "/master/lgpd" })]);
    expect(shellFromSignals({ lgpd: { pending: 2, overdue: 0 } }).alerts).toEqual([expect.objectContaining({ severity: "info", title: "2 solicitações LGPD pendentes", href: "/master/lgpd" })]);
    expect(shellFromSignals({ lgpd: { pending: 0, overdue: 0 } }).alerts).toEqual([]);
  });

  it("pagamentos: desligado é info, sandbox é warn, produção não alerta; ambiente exato no texto", () => {
    const off = shellFromSignals({ payments: { env: "desligado", divergences: 0 } }).alerts;
    expect(off).toEqual([expect.objectContaining({ severity: "info", href: "/master/pagamentos" })]);
    expect(off[0].text).toContain("desligado");
    const sb = shellFromSignals({ payments: { env: "sandbox", divergences: 0 } }).alerts;
    expect(sb).toEqual([expect.objectContaining({ severity: "warn", title: "Pagamentos em sandbox" })]);
    expect(sb[0].text).toContain("sandbox");
    expect(shellFromSignals({ payments: { env: "production", divergences: 0 } }).alerts).toEqual([]);
  });

  it("divergência de pagamento é crítica mesmo em produção", () => {
    const { alerts } = shellFromSignals({ payments: { env: "production", divergences: 2 } });
    expect(alerts).toEqual([expect.objectContaining({ severity: "crit", title: "2 divergências de pagamento", href: "/master/pagamentos" })]);
  });

  it("dados da empresa faltando: warn com contagem e quais", () => {
    const { alerts } = shellFromSignals({ settingsMissing: ["company_cnpj", "support_phone"] });
    expect(alerts[0]).toMatchObject({ severity: "warn", title: "Dados da empresa incompletos", href: "/master/configuracoes" });
    expect(alerts[0].text).toBe("Faltam 2: CNPJ, telefone de suporte.");
    expect(shellFromSignals({ settingsMissing: [] }).alerts).toEqual([]);
  });

  it("ordena crítico, atenção, aviso", () => {
    const { alerts } = shellFromSignals({
      payments: { env: "sandbox", divergences: 0 }, lgpd: { pending: 1, overdue: 0 }, reveals: { pending: 1, overdue: 1 }, settingsMissing: ["company_cnpj"],
    });
    expect(alerts.map((a) => a.severity)).toEqual(["crit", "warn", "warn", "info"]);
  });

  it("texto sem travessão", () => {
    const { alerts } = shellFromSignals({
      payments: { env: "sandbox", divergences: 3 }, lgpd: { pending: 1, overdue: 1 }, reveals: { pending: 1, overdue: 1 },
      settingsMissing: ["company_cnpj"], jobs: { total: 2, failing: ["mm-x"] },
    });
    for (const a of alerts) expect(`${a.title} ${a.text ?? ""} ${a.cta}`).not.toMatch(/[—–]/);
  });
});

describe("shellFromSignals: badges", () => {
  it("revelações = pendentes; warn quando há atraso", () => {
    expect(shellFromSignals({ reveals: { pending: 3, overdue: 0 } }).badges.revelacoes).toMatchObject({ value: 3, severity: "dim" });
    expect(shellFromSignals({ reveals: { pending: 3, overdue: 1 } }).badges.revelacoes).toMatchObject({ value: 3, severity: "warn" });
    expect(shellFromSignals({ reveals: { pending: 0, overdue: 0 } }).badges.revelacoes).toBeUndefined();
  });

  it("lgpd = pendentes (crit se atrasada)", () => {
    expect(shellFromSignals({ lgpd: { pending: 2, overdue: 0 } }).badges.lgpd).toMatchObject({ value: 2, severity: "info" });
    expect(shellFromSignals({ lgpd: { pending: 2, overdue: 1 } }).badges.lgpd).toMatchObject({ value: 2, severity: "crit" });
  });

  it("configurações = quantidade faltando", () => {
    expect(shellFromSignals({ settingsMissing: ["company_cnpj", "support_email"] }).badges.configuracoes).toMatchObject({ value: 2, severity: "warn" });
  });

  it("pagamentos = rótulo do ambiente com severidade; divergência vira crit", () => {
    expect(shellFromSignals({ payments: { env: "desligado", divergences: 0 } }).badges.pagamentos).toMatchObject({ value: "off", severity: "info" });
    expect(shellFromSignals({ payments: { env: "sandbox", divergences: 0 } }).badges.pagamentos).toMatchObject({ value: "sandbox", severity: "warn" });
    expect(shellFromSignals({ payments: { env: "production", divergences: 0 } }).badges.pagamentos).toMatchObject({ value: "prod", severity: "ok" });
    expect(shellFromSignals({ payments: { env: "production", divergences: 1 } }).badges.pagamentos).toMatchObject({ value: "prod", severity: "crit" });
  });

  it("saúde = ok N/N ou contagem de falhas", () => {
    expect(shellFromSignals({ jobs: { total: 4, failing: [] } }).badges.saude).toMatchObject({ value: "ok 4/4", severity: "ok" });
    expect(shellFromSignals({ jobs: { total: 4, failing: ["a"] } }).badges.saude).toMatchObject({ value: 1, severity: "crit" });
    expect(shellFromSignals({ jobs: { total: 0, failing: [] } }).badges.saude).toBeUndefined();
  });

  it("badges trazem rótulo acessível", () => {
    const b = shellFromSignals({ reveals: { pending: 3, overdue: 1 } }).badges.revelacoes;
    expect(b?.label).toBe("3 pendentes, 1 atrasada");
  });
});

describe("missingSettings", () => {
  it("considera ausente o que não é texto preenchido, na ordem fixa", () => {
    expect(missingSettings({ company_cnpj: null, company_legal_name: "  ", support_email: "a@b.c", support_phone: 65 })).toEqual(["company_cnpj", "company_legal_name", "support_phone"]);
    expect(missingSettings({ company_cnpj: "1", company_legal_name: "X", support_email: "a@b.c", support_phone: "65" })).toEqual([]);
  });
});

describe("signalsFromOverview", () => {
  it("mapeia o contrato de admin_overview", () => {
    const s = signalsFromOverview({
      alerts: { pendingReveals: 3, overdueReveals: 1, lgpdPending: 2, lgpdOverdue: 0, settingsMissing: 2, paymentDivergences: 0, failingJobs: 1 },
      readiness: { companyCnpj: false, companyLegalName: true, supportEmail: true, supportPhone: false, paymentsEnv: "sandbox", lastWebhookAt: null },
      jobs: [{ name: "mm-a", ok: true }, { name: "mm-b", ok: false }],
    });
    expect(s).toEqual({
      reveals: { pending: 3, overdue: 1 }, lgpd: { pending: 2, overdue: 0 }, jobs: { total: 2, failing: ["mm-b"] },
      payments: { env: "sandbox", divergences: 0 }, settingsMissing: ["company_cnpj", "support_phone"],
    });
  });
  it("formato inesperado não quebra", () => {
    expect(signalsFromOverview(null)).toEqual({});
    expect(signalsFromOverview({})).toEqual({});
  });
});

describe("signalsFromLegacy", () => {
  it("compõe as RPCs antigas", () => {
    const s = signalsFromLegacy({
      metrics: { reveals: { pending: 2, overdue: 1 } },
      lgpd: { summary: { pending: 1, overdue: 1, processed: 4 } },
      health: { cronAvailable: true, jobs: [
        { name: "mm-a", active: true, lastRun: { status: "succeeded" } },
        { name: "mm-b", active: true, lastRun: { status: "failed" } },
        { name: "mm-c", active: false, lastRun: { status: "failed" } },
        { name: "mm-d", active: true, lastRun: null },
      ] },
      payments: { env: "desligado", divergences: 0 },
      settings: { company_cnpj: null, company_legal_name: "X", support_email: "a@b.c", support_phone: "65", payments_env: "desligado" },
    });
    expect(s).toEqual({
      reveals: { pending: 2, overdue: 1 }, lgpd: { pending: 1, overdue: 1 }, jobs: { total: 3, failing: ["mm-b"] },
      payments: { env: "desligado", divergences: 0 }, settingsMissing: ["company_cnpj"],
    });
  });
  it("sem resumo de pagamentos usa o ambiente das configurações públicas", () => {
    const s = signalsFromLegacy({ settings: { payments_env: "sandbox", company_cnpj: "1", company_legal_name: "X", support_email: "a", support_phone: "b" } });
    expect(s.payments).toEqual({ env: "sandbox", divergences: null });
  });
  it("partes ausentes ficam de fora; cron indisponível não conta rotinas", () => {
    expect(signalsFromLegacy({ health: { cronAvailable: false, jobs: [] } })).toEqual({});
  });
});
