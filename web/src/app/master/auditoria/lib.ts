/** Regras puras da página Auditoria: categorias, papéis, sensibilidade, agrupamento por dia, alvo. */

export const TZ = "America/Cuiaba";

export type Category = "participante" | "consentimento" | "revelacao" | "admin" | "pagamento";
/** Mesmos prefixos de `audit_category_pattern` no banco. `legacy` = prefixo único usado sem a RPC nova. */
export const CATEGORIES: { key: Category; label: string; prefixes: string[]; legacy: string }[] = [
  { key: "participante", label: "Participante", prefixes: ["participant.", "invitation."], legacy: "participant." },
  { key: "consentimento", label: "Consentimento", prefixes: ["consent.", "account."], legacy: "consent." },
  { key: "revelacao", label: "Revelação", prefixes: ["reveal."], legacy: "reveal." },
  { key: "admin", label: "Admin", prefixes: ["admin.", "platform_role.", "platform_settings.", "feature_flags.", "plan.", "entitlement.", "audit.", "code.", "system.", "retention.", "event.", "photo.access"], legacy: "admin." },
  { key: "pagamento", label: "Pagamento", prefixes: ["payment.", "apply."], legacy: "payment." },
];

export function categoryOf(v: string | string[] | undefined): Category | null {
  const s = Array.isArray(v) ? v[0] : v;
  return CATEGORIES.some((c) => c.key === s) ? (s as Category) : null;
}

/** Categoria a que uma ação pertence (null se nenhuma). */
export function actionCategory(action: string): Category | null {
  return CATEGORIES.find((c) => c.prefixes.some((p) => action.startsWith(p)))?.key ?? null;
}

/** O fallback (`admin_list_audit`) só filtra um prefixo: a categoria fica parcial quando tem mais de um. */
export const legacyIsPartial = (c: Category) => CATEGORIES.find((x) => x.key === c)!.prefixes.length > 1;

/** Espelha `sensitive` de `admin_list_audit_v2` para o modo degradado. */
const SENSITIVE = /^(admin\.|platform_role\.|platform_settings\.|feature_flags\.|plan\.updated|entitlement\.courtesy|payment\.refund|photo\.access|audit\.)/;
export function isSensitive(action: string, reason: string | null | undefined): boolean {
  return (reason != null && reason !== "") || SENSITIVE.test(action);
}

/** `actor_role` é gravado em português (sistema, organizador, convidado) ou com o papel de plataforma. */
const ROLES: Record<string, string> = {
  sistema: "Sistema", organizador: "Organizador", convidado: "Convidado", operador: "Operador",
  master: "Master", support: "Suporte", auditor: "Auditor",
};
export const roleLabel = (r: string | null | undefined) => (r ? ROLES[r] ?? r : "—");

/** Data local (YYYY-MM-DD) no fuso de Cuiabá. */
export const localDay = (iso: string, tz = TZ) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

/** Agrupa itens já ordenados (mais novo primeiro) por dia local, preservando a ordem. */
export function groupByDay<T extends { at: string }>(items: readonly T[], tz = TZ): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = [];
  for (const it of items) {
    const d = localDay(it.at, tz);
    const last = out[out.length - 1];
    if (last && last.day === d) last.items.push(it); else out.push({ day: d, items: [it] });
  }
  return out;
}

/** "2026-10-23" → "sexta, 23/10/2026". */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" }).replace("-feira", "");
  return `${wd}, ${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

export interface AuditItem {
  id: number; at: string; actorId: string | null; actorRole: string | null; eventId: string | null;
  action: string; targetType: string | null; targetId: string | null; reason: string | null;
  eventTitle?: string | null; sensitive?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Id do evento-alvo, quando houver (alvo `event` ou evento da linha). */
export function targetEvent(x: Pick<AuditItem, "targetType" | "targetId" | "eventId">): string | null {
  if (x.targetType === "event" && x.targetId && UUID.test(x.targetId)) return x.targetId;
  if (x.eventId && UUID.test(x.eventId)) return x.eventId;
  return null;
}

/** Texto do alvo sem expor ids inteiros. */
export function targetText(x: Pick<AuditItem, "targetType" | "targetId" | "eventTitle">): string {
  if (x.eventTitle) return x.eventTitle;
  if (!x.targetType) return "—";
  return `${x.targetType}${x.targetId ? `:${x.targetId.slice(0, 8)}` : ""}`;
}
