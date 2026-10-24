/**
 * Sinais do shell do console (barra de alertas + badges do menu). Puro: recebe o que as RPCs devolveram
 * (`admin_overview` ou a composição das antigas) e decide o que avisar e onde resolver.
 */

export type Severity = "crit" | "warn" | "info";
export type BadgeTone = "ok" | "warn" | "crit" | "info" | "dim";
/** Mesmo formato do `AlertItem` do kit (`app/master/kit/AlertBar`). */
export interface ShellAlert { id: string; severity: Severity; title: string; text?: string; href: string; cta: string }
/** Badge do menu: `value` visível, `label` para leitor de tela. */
export interface NavBadge { value: string | number; severity: BadgeTone; label?: string }

export const SETTING_KEYS = ["company_cnpj", "company_legal_name", "support_email", "support_phone"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
const SETTING_LABEL: Record<SettingKey, string> = {
  company_cnpj: "CNPJ", company_legal_name: "razão social", support_email: "e-mail de suporte", support_phone: "telefone de suporte",
};

export interface ShellSignals {
  reveals?: { pending: number; overdue: number } | null;
  lgpd?: { pending: number; overdue: number } | null;
  /** `total` = rotinas ativas acompanhadas; `failing` = nomes cuja última execução falhou. */
  jobs?: { total: number; failing: string[] } | null;
  /** `env` exato de `payments_env()`; `divergences` nulo quando não se sabe (sem resumo de pagamentos). */
  payments?: { env: string; divergences: number | null } | null;
  settingsMissing?: SettingKey[] | null;
}

export interface ShellState { alerts: ShellAlert[]; badges: Partial<Record<string, NavBadge>> }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ORDER: Record<Severity, number> = { crit: 0, warn: 1, info: 2 };

const ENV_BADGE: Record<string, { value: string; severity: BadgeTone; label: string }> = {
  production: { value: "prod", severity: "ok", label: "Ambiente de produção" },
  sandbox: { value: "sandbox", severity: "warn", label: "Ambiente sandbox" },
  desligado: { value: "off", severity: "info", label: "Pagamentos desligados" },
};

export function shellFromSignals(s: ShellSignals): ShellState {
  const alerts: ShellAlert[] = [];
  const badges: ShellState["badges"] = {};

  if (s.reveals) {
    const { pending, overdue } = s.reveals;
    if (overdue > 0) {
      alerts.push({ id: "revelacoes-atrasadas", severity: "crit", title: plural(overdue, "revelação atrasada", "revelações atrasadas"),
        text: "O horário já passou e as fotos não foram liberadas.", href: "/master/revelacoes", cta: "Ver revelações" });
    }
    if (pending > 0) {
      badges.revelacoes = { value: pending, severity: overdue > 0 ? "warn" : "dim",
        label: overdue > 0 ? `${plural(pending, "pendente", "pendentes")}, ${plural(overdue, "atrasada", "atrasadas")}` : plural(pending, "pendente", "pendentes") };
    }
  }

  if (s.jobs && s.jobs.total > 0) {
    const { total, failing } = s.jobs;
    if (failing.length > 0) {
      alerts.push({ id: "rotinas-falhando", severity: "crit", title: plural(failing.length, "rotina falhando", "rotinas falhando"),
        text: `Última execução falhou: ${failing.join(", ")}.`, href: "/master/saude", cta: "Ver saúde" });
      badges.saude = { value: failing.length, severity: "crit", label: plural(failing.length, "rotina falhando", "rotinas falhando") };
    } else {
      badges.saude = { value: `ok ${total}/${total}`, severity: "ok", label: `${total} de ${total} rotinas sem falha` };
    }
  }

  if (s.lgpd) {
    const { pending, overdue } = s.lgpd;
    if (overdue > 0) {
      alerts.push({ id: "lgpd-atrasada", severity: "crit", title: plural(overdue, "solicitação LGPD atrasada", "solicitações LGPD atrasadas"),
        text: "O prazo de 15 dias venceu.", href: "/master/lgpd", cta: "Ver solicitações" });
    } else if (pending > 0) {
      alerts.push({ id: "lgpd-pendente", severity: "info", title: plural(pending, "solicitação LGPD pendente", "solicitações LGPD pendentes"),
        text: "Responder em até 15 dias.", href: "/master/lgpd", cta: "Ver solicitações" });
    }
    if (pending > 0) {
      badges.lgpd = { value: pending, severity: overdue > 0 ? "crit" : "info",
        label: overdue > 0 ? `${plural(pending, "pendente", "pendentes")}, ${plural(overdue, "atrasada", "atrasadas")}` : plural(pending, "pendente", "pendentes") };
    }
  }

  if (s.payments) {
    const { env, divergences } = s.payments;
    const div = divergences ?? 0;
    if (div > 0) {
      alerts.push({ id: "pagamentos-divergencias", severity: "crit", title: plural(div, "divergência de pagamento", "divergências de pagamento"),
        text: "Valor ou status diferente do provedor.", href: "/master/pagamentos", cta: "Ver pagamentos" });
    }
    if (env === "sandbox") {
      alerts.push({ id: "pagamentos-ambiente", severity: "warn", title: "Pagamentos em sandbox",
        text: "Ambiente: sandbox. As cobranças não são reais.", href: "/master/pagamentos", cta: "Ver pagamentos" });
    } else if (env !== "production") {
      alerts.push({ id: "pagamentos-ambiente", severity: "info", title: "Pagamentos desligados",
        text: `Ambiente: ${env || "desligado"}. Novas cobranças estão bloqueadas.`, href: "/master/pagamentos", cta: "Ver pagamentos" });
    }
    const b = ENV_BADGE[env] ?? { value: "off", severity: "info" as const, label: `Ambiente ${env || "desligado"}` };
    badges.pagamentos = div > 0
      ? { value: b.value, severity: "crit", label: `${b.label}, ${plural(div, "divergência", "divergências")}` }
      : { ...b };
  }

  if (s.settingsMissing && s.settingsMissing.length > 0) {
    const n = s.settingsMissing.length;
    alerts.push({ id: "dados-empresa", severity: "warn", title: "Dados da empresa incompletos",
      text: `${n === 1 ? "Falta" : "Faltam"} ${n}: ${s.settingsMissing.map((k) => SETTING_LABEL[k]).join(", ")}.`, href: "/master/configuracoes", cta: "Completar dados" });
    badges.configuracoes = { value: n, severity: "warn", label: plural(n, "dado da empresa faltando", "dados da empresa faltando") };
  }

  alerts.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return { alerts, badges };
}

// ---------------------------------------------------------------- normalização das RPCs

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const filled = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Chaves de `get_public_settings` (ou `platform_settings`) sem texto preenchido, na ordem fixa. */
export function missingSettings(values: Partial<Record<SettingKey, unknown>>): SettingKey[] {
  return SETTING_KEYS.filter((k) => !filled(values[k]));
}

/** Contrato de `admin_overview` (alerts + readiness + jobs). */
export function signalsFromOverview(data: unknown): ShellSignals {
  const d = obj(data);
  if (!d) return {};
  const out: ShellSignals = {};
  const a = obj(d.alerts);
  const r = obj(d.readiness);
  if (a) {
    out.reveals = { pending: n(a.pendingReveals), overdue: n(a.overdueReveals) };
    out.lgpd = { pending: n(a.lgpdPending), overdue: n(a.lgpdOverdue) };
  }
  if (Array.isArray(d.jobs)) {
    const jobs = d.jobs.map(obj).filter((j): j is Obj => !!j);
    out.jobs = { total: jobs.length, failing: jobs.filter((j) => j.ok === false).map((j) => String(j.name ?? "")) };
  }
  if (r && typeof r.paymentsEnv === "string") out.payments = { env: r.paymentsEnv, divergences: a ? n(a.paymentDivergences) : null };
  if (r) {
    const has: Record<SettingKey, unknown> = { company_cnpj: r.companyCnpj, company_legal_name: r.companyLegalName, support_email: r.supportEmail, support_phone: r.supportPhone };
    out.settingsMissing = SETTING_KEYS.filter((k) => has[k] !== true);
  }
  return out;
}

export interface LegacyInputs {
  /** `admin_dashboard_metrics` */ metrics?: unknown;
  /** `admin_lgpd_requests` */ lgpd?: unknown;
  /** `admin_health` */ health?: unknown;
  /** `admin_payments_summary` (só master) */ payments?: unknown;
  /** `get_public_settings` */ settings?: unknown;
}

/** Composição das RPCs antigas quando `admin_overview` ainda não existe no banco. */
export function signalsFromLegacy(i: LegacyInputs): ShellSignals {
  const out: ShellSignals = {};
  const rv = obj(obj(i.metrics)?.reveals);
  if (rv) out.reveals = { pending: n(rv.pending), overdue: n(rv.overdue) };

  const lg = obj(obj(i.lgpd)?.summary);
  if (lg) out.lgpd = { pending: n(lg.pending), overdue: n(lg.overdue) };

  const h = obj(i.health);
  if (h && h.cronAvailable !== false && Array.isArray(h.jobs)) {
    const ativos = h.jobs.map(obj).filter((j): j is Obj => !!j && j.active !== false);
    if (ativos.length) out.jobs = { total: ativos.length, failing: ativos.filter((j) => obj(j.lastRun)?.status === "failed").map((j) => String(j.name ?? "")) };
  }

  const p = obj(i.payments);
  const st = obj(i.settings);
  if (p && typeof p.env === "string") out.payments = { env: p.env, divergences: n(p.divergences) };
  else if (st && typeof st.payments_env === "string") out.payments = { env: st.payments_env, divergences: null };

  if (st) out.settingsMissing = missingSettings(st as Partial<Record<SettingKey, unknown>>);
  return out;
}
