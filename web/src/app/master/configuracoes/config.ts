/** Lógica pura da tela M14 (Configurações): campos, validação e a lista de mudanças a gravar (admin_set_setting / admin_set_feature_flag). */
import type { IconName } from "@/revela/master-kit";

export const PIX_MIN = 5;
export const PIX_MAX = 1440;
export const PIX_KEY = "validapay_pix_expiry_minutes";
export const CARD_FLAG = "validapay_card";
export const CHECKOUT_FLAG = "validapay_checkout";

export interface SettingField { key: string; label: string; icon: IconName; placeholder?: string; hint?: string; numeric?: boolean }
/** Parâmetros reais de platform_settings que o app lê (contato público, empresa e folga de capacidade). */
export const SETTING_FIELDS: SettingField[] = [
  { key: "support_email", label: "E-mail de suporte", icon: "mail", placeholder: "suporte@exemplo.com" },
  { key: "support_phone", label: "Telefone de suporte", icon: "chat", placeholder: "(65) 90000-0000" },
  { key: "company_legal_name", label: "Razão social", icon: "tag", placeholder: "Nome da empresa" },
  { key: "company_cnpj", label: "CNPJ", icon: "ticket", placeholder: "00.000.000/0000-00" },
  { key: "capacity_grace_pct", label: "Folga de capacidade (%)", icon: "bell", placeholder: "0", numeric: true, hint: "Convidados além do limite do plano que ainda entram, de 0 a 100." },
];

export interface ConfigState { pixMinutes: string; card: boolean; checkout: boolean; settings: Record<string, string> }

export function fieldError(key: string, raw: string): string | null {
  const v = raw.trim();
  if (key === PIX_KEY) return /^\d+$/.test(v) && Number(v) >= PIX_MIN && Number(v) <= PIX_MAX ? null : `Validade do Pix: de ${PIX_MIN} a ${PIX_MAX} minutos.`;
  if (v === "") return null; // vazio = remover o valor
  if (key === "support_email") return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido.";
  if (key === "capacity_grace_pct") return /^\d{1,3}$/.test(v) && Number(v) <= 100 ? null : "Folga: número de 0 a 100.";
  if (key === "support_phone") return v.length <= 40 ? null : "Telefone longo demais.";
  if (key === "company_cnpj") return v.length <= 24 ? null : "CNPJ longo demais.";
  return v.length <= 120 ? null : "Texto longo demais (até 120).";
}

export interface ConfigChange { kind: "setting" | "flag"; key: string; label: string; value: unknown; from: string; to: string }
const onOff = (b: boolean) => (b ? "ligado" : "desligado");
const show = (v: string) => (v.trim() === "" ? "vazio" : v.trim());

/** Só o que mudou, já no valor que o servidor recebe (número ou texto, vazio vira ""; chave = booleano). */
export function changesOf(a: ConfigState, b: ConfigState): ConfigChange[] {
  const out: ConfigChange[] = [];
  if (a.pixMinutes.trim() !== b.pixMinutes.trim()) out.push({ kind: "setting", key: PIX_KEY, label: "Validade do Pix (min)", value: Number(b.pixMinutes), from: show(a.pixMinutes), to: show(b.pixMinutes) });
  if (a.card !== b.card) out.push({ kind: "flag", key: CARD_FLAG, label: "Cartão de crédito", value: b.card, from: onOff(a.card), to: onOff(b.card) });
  if (a.checkout !== b.checkout) out.push({ kind: "flag", key: CHECKOUT_FLAG, label: "Checkout ligado para anfitriões", value: b.checkout, from: onOff(a.checkout), to: onOff(b.checkout) });
  for (const f of SETTING_FIELDS) {
    const x = (a.settings[f.key] ?? "").trim(), y = (b.settings[f.key] ?? "").trim();
    if (x !== y) out.push({ kind: "setting", key: f.key, label: f.label, value: f.numeric ? (y === "" ? 0 : Number(y)) : y, from: show(x), to: show(y) });
  }
  return out;
}
