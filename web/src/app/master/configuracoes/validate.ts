/**
 * Validação pura do "Cadastro da empresa" (roda no navegador e de novo na server action).
 * `payments_env` NUNCA é editável por aqui: muda só pelo procedimento de pagamentos.
 */

export const COMPANY_FIELDS = [
  { key: "company_legal_name", label: "Razão social", help: "Nome empresarial como no CNPJ.", inputMode: "text" },
  { key: "company_cnpj", label: "CNPJ", help: "14 caracteres; aceita o formato numérico e o alfanumérico.", inputMode: "text" },
  { key: "support_email", label: "E-mail de suporte", help: "Aparece para clientes no rodapé e nos recibos.", inputMode: "email" },
  { key: "support_phone", label: "Telefone de suporte", help: "Com DDD. Ex.: (65) 99999-0000.", inputMode: "tel" },
] as const;
export type CompanyKey = (typeof COMPANY_FIELDS)[number]["key"];

/** Chaves que o formulário pode gravar. Qualquer outra (inclusive `payments_env`) é recusada. */
export const EDITABLE_KEYS: readonly CompanyKey[] = COMPANY_FIELDS.map((f) => f.key);
export const READ_ONLY_KEYS = ["payments_env"] as const;
export function isEditableKey(key: unknown): key is CompanyKey {
  return typeof key === "string" && (EDITABLE_KEYS as readonly string[]).includes(key) && !(READ_ONLY_KEYS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------- CNPJ (numérico e alfanumérico, IN RFB 2.229/2024)

const cnpjChars = (raw: string) => raw.toUpperCase().replace(/[.\-/\s]/g, "");

function dv(base: string): number {
  // valor do caractere = código ASCII - 48 (dígitos 0..9, letras A=17 .. Z=42); pesos 2..9 da direita para a esquerda
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const w = ((base.length - 1 - i) % 8) + 2;
    sum += (base.charCodeAt(i) - 48) * w;
  }
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function isValidCnpj(raw: string): boolean {
  const c = cnpjChars(raw);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const d1 = dv(c.slice(0, 12));
  const d2 = dv(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

/** "11222333000181" → "11.222.333/0001-81". */
export function formatCnpj(raw: string): string {
  const c = cnpjChars(raw);
  return c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : raw.trim();
}

// ---------------------------------------------------------------- e-mail e telefone

export function isValidEmail(raw: string): boolean {
  const s = raw.trim();
  if (s.length > 254) return false;
  const m = /^([^\s@]{1,64})@([^\s@]+)$/.exec(s);
  if (!m) return false;
  const labels = m[2].split(".");
  return labels.length >= 2 && labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(l)) && /^[a-z]{2,}$/i.test(labels[labels.length - 1]);
}

const digits = (s: string) => s.replace(/\D/g, "");
/** Telefone brasileiro: fixo ou celular com DDD (aceita +55) ou 0800. Devolve formatado ou null. */
export function formatPhone(raw: string): string | null {
  let d = digits(raw);
  if (/^0800\d{7}$/.test(d)) return `0800 ${d.slice(4, 7)} ${d.slice(7)}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (!/^[1-9][1-9]\d{8,9}$/.test(d)) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  const ddd = d.slice(0, 2), rest = d.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

// ---------------------------------------------------------------- campo a campo

export type Checked = { ok: true; value: string } | { ok: false; error: string };

/** Valida e normaliza o valor de uma chave editável. */
export function validateSetting(key: string, raw: string): Checked {
  if (!isEditableKey(key)) return { ok: false, error: "Este campo não pode ser alterado aqui." };
  const v = (raw ?? "").trim();
  if (!v) return { ok: false, error: "Preencha o campo." };
  switch (key) {
    case "company_cnpj":
      return isValidCnpj(v) ? { ok: true, value: formatCnpj(v) } : { ok: false, error: "CNPJ inválido: confira os 14 caracteres e os dígitos verificadores." };
    case "support_email":
      return isValidEmail(v) ? { ok: true, value: v } : { ok: false, error: "E-mail inválido. Ex.: suporte@empresa.com.br" };
    case "support_phone": {
      const f = formatPhone(v);
      return f ? { ok: true, value: f } : { ok: false, error: "Telefone inválido: use DDD e número, ou 0800." };
    }
    case "company_legal_name":
      if (v.length < 3 || v.length > 150) return { ok: false, error: "A razão social deve ter de 3 a 150 caracteres." };
      if (/[\u0000-\u001f\u007f]/.test(v)) return { ok: false, error: "Remova caracteres de controle." };
      return { ok: true, value: v.replace(/\s+/g, " ") };
  }
}

/** Texto de um valor jsonb de configuração ("null", não texto ou vazio = ausente). */
export function settingText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

// ---------------------------------------------------------------- descrições

const SETTING_NOTES: Record<string, string> = {
  payments_env: "Ambiente de cobrança (desligado, sandbox ou produção). Alterado só pelo procedimento de pagamentos.",
  capacity_grace_pct: "Folga percentual sobre a capacidade do plano antes de bloquear novas entradas.",
  company_cnpj: "CNPJ exibido em recibos e no rodapé.",
  company_legal_name: "Razão social exibida em recibos e no rodapé.",
  support_email: "Contato de suporte exibido aos clientes.",
  support_phone: "Telefone de suporte exibido aos clientes.",
};
export const settingNote = (key: string) => SETTING_NOTES[key] ?? "Sem descrição cadastrada.";

const FLAG_NOTES: Record<string, string> = {};
/** Descrição da flag: texto conhecido ou, na falta, o resumo do rollout. */
export function flagDescription(key: string, rollout: unknown): string {
  const known = FLAG_NOTES[key];
  const r = rollout && typeof rollout === "object" ? (rollout as Record<string, unknown>) : {};
  const parts: string[] = [];
  if (typeof r.description === "string" && r.description.trim()) parts.push(r.description.trim());
  if (typeof r.percent === "number") parts.push(`liberada para ${r.percent}% das contas`);
  const rest = Object.keys(r).filter((k) => k !== "description" && k !== "percent");
  if (rest.length) parts.push(`regras: ${rest.join(", ")}`);
  if (known) parts.unshift(known);
  return parts.length ? parts.join("; ") : "Sem descrição cadastrada; vale para todas as contas quando ligada.";
}
