/** Lógica pura da tela M31 (Configurações): campos editáveis, validação (o servidor confere de novo), textos das folhas e a leitura de `admin_config_overview`. */
import type { ConfigEditKey, ConfigFlagKey, MasterConfigRevisadaViewProps } from "@/revela/screens/MasterConfigRevisada";

export const PIX_MIN = 5;
export const PIX_MAX = 1440;
/** Chave de platform_settings de cada campo editável. */
export const SETTING_KEY: Record<ConfigEditKey, string> = {
  pix: "validapay_pix_expiry_minutes", support_email: "support_email", support_phone: "support_phone",
  company_legal_name: "company_legal_name", company_cnpj: "company_cnpj", capacity_grace_pct: "capacity_grace_pct",
};

export interface ConfigOverview {
  paymentsEnv: string;
  flags: { validapay_checkout: boolean; validapay_card: boolean; printed_album: boolean };
  settings: { pixMinutes: number; supportEmail: string | null; supportPhone: string | null; companyLegalName: string | null; companyCnpj: string | null; capacityGracePct: number };
  webhook: { lastAt: string | null; pending: number; failing: number } | null;
}

const ENV: Record<string, { label: string; tone: "ok" | "wait" | "info" }> = {
  production: { label: "Produção", tone: "ok" }, sandbox: { label: "Sandbox", tone: "wait" }, desligado: { label: "Desligado", tone: "info" },
};

/** Valores exibidos na tela (texto pronto). */
export function viewOf(o: ConfigOverview, webhookUrl: string, when: (iso: string) => string): Pick<MasterConfigRevisadaViewProps, "env" | "flags" | "values" | "webhook"> {
  const s = o.settings;
  const w = o.webhook;
  const state = w && w.failing > 0 ? { label: "Com falhas", tone: "bad" as const } : w?.lastAt ? { label: "Ativo", tone: "ok" as const } : { label: "Sem eventos", tone: "info" as const };
  return {
    env: ENV[o.paymentsEnv] ?? ENV.desligado,
    flags: o.flags,
    values: {
      pix: `${s.pixMinutes} min`, support_email: s.supportEmail ?? "—", support_phone: s.supportPhone ?? "—",
      company_legal_name: s.companyLegalName ?? "—", company_cnpj: s.companyCnpj ?? "—", capacity_grace_pct: `${s.capacityGracePct}%`,
    },
    webhook: { meta: `${webhookUrl} · ${w?.lastAt ? `último evento ${when(w.lastAt)}` : "nenhum evento recebido ainda"}`, ...state },
  };
}

/** Texto para o campo da folha, como está hoje. */
export function rawOf(key: ConfigEditKey, o: ConfigOverview): string {
  const s = o.settings;
  switch (key) {
    case "pix": return String(s.pixMinutes);
    case "capacity_grace_pct": return String(s.capacityGracePct);
    case "support_email": return s.supportEmail ?? "";
    case "support_phone": return s.supportPhone ?? "";
    case "company_legal_name": return s.companyLegalName ?? "";
    default: return s.companyCnpj ?? "";
  }
}

export function fieldError(key: ConfigEditKey, raw: string): string | null {
  const v = raw.trim();
  if (key === "pix") return /^\d+$/.test(v) && Number(v) >= PIX_MIN && Number(v) <= PIX_MAX ? null : `Validade do Pix: de ${PIX_MIN} a ${PIX_MAX.toLocaleString("pt-BR")} minutos.`;
  if (key === "capacity_grace_pct") return /^\d{1,3}$/.test(v) && Number(v) <= 100 ? null : "Folga: número de 0 a 100.";
  if (v === "") return null; // vazio = remover o valor
  if (key === "support_email") return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido.";
  if (key === "support_phone") return v.length <= 40 ? null : "Telefone longo demais.";
  if (key === "company_cnpj") return v.length <= 24 ? null : "CNPJ longo demais.";
  return v.length <= 120 ? null : "Texto longo demais (até 120).";
}

/** O que a RPC recebe (número para Pix e folga; texto para o resto, vazio remove o valor). */
export const jsonOf = (key: ConfigEditKey, raw: string): number | string => (key === "pix" || key === "capacity_grace_pct" ? Number(raw.trim() || 0) : raw.trim());

export interface EditMeta { title: string; body: string; fieldLabel: string; inputLabel: string; unit?: string }
export const EDIT: Record<ConfigEditKey, EditMeta> = {
  pix: { title: "Alterar a validade do Pix", body: "Vale para os próximos Pix gerados. Os que já estão abertos mantêm a validade antiga.", fieldLabel: "Novo valor (5 a 1.440)", inputLabel: "Minutos", unit: "min" },
  support_email: { title: "Alterar o e-mail do suporte", body: "Aparece nas páginas públicas e nos avisos do Revela. Vale na hora.", fieldLabel: "Novo e-mail", inputLabel: "E-mail do suporte" },
  support_phone: { title: "Alterar o telefone do suporte", body: "Aparece nas páginas públicas e nos avisos do Revela. Vale na hora.", fieldLabel: "Novo telefone", inputLabel: "Telefone do suporte" },
  company_legal_name: { title: "Alterar a razão social", body: "Aparece nos recibos e nas páginas legais. Vale na hora.", fieldLabel: "Nova razão social", inputLabel: "Razão social" },
  company_cnpj: { title: "Alterar o CNPJ", body: "Aparece nos recibos e nas páginas legais. Vale na hora.", fieldLabel: "Novo CNPJ", inputLabel: "CNPJ" },
  capacity_grace_pct: { title: "Alterar a folga de capacidade", body: "Convidados aceitos acima do limite do plano, de 0% a 100%. Vale na hora.", fieldLabel: "Novo valor (0 a 100)", inputLabel: "Percentual", unit: "%" },
};

export interface FlagMeta { title: string; body: string; confirm: string; busy: string; tone: "primary" | "danger" }
/** Folha de cada chave, para ligar (`on`) e para desligar. Checkout desligado é o texto do desenho (M31.f2). */
export const FLAG: Record<ConfigFlagKey, { on: FlagMeta; off: FlagMeta }> = {
  validapay_checkout: {
    on: { title: "Ligar o checkout?", body: "Anfitriões passam a conseguir pagar planos.", confirm: "Ligar checkout", busy: "Ligando…", tone: "primary" },
    off: { title: "Desligar o checkout?", body: "Ninguém consegue pagar planos enquanto estiver desligado. Eventos já pagos não mudam.", confirm: "Desligar checkout", busy: "Desligando…", tone: "danger" },
  },
  validapay_card: {
    on: { title: "Ligar o cartão?", body: "O checkout passa a oferecer cartão, sempre com confirmação do banco (3DS).", confirm: "Ligar cartão", busy: "Ligando…", tone: "primary" },
    off: { title: "Desligar o cartão?", body: "O checkout volta a oferecer só Pix. Pagamentos já feitos não mudam.", confirm: "Desligar cartão", busy: "Desligando…", tone: "danger" },
  },
  printed_album: {
    on: { title: "Ligar o álbum impresso?", body: "Impressões aparece no menu e anfitriões e convidados passam a pedir impressão.", confirm: "Ligar álbum impresso", busy: "Ligando…", tone: "primary" },
    off: { title: "Desligar o álbum impresso?", body: "Impressões some do menu, as rotas respondem 404 e o pedido de impressão some para o anfitrião. Pedidos já feitos não mudam.", confirm: "Desligar álbum impresso", busy: "Desligando…", tone: "danger" },
  },
};
