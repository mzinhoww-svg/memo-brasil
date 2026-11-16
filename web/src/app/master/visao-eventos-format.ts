/** Formatos e rótulos das telas Visão geral, Detalhe do evento e Eventos de teste (M20 a M22). Fuso de Cuiabá e pt-BR. */
import { relWhen } from "./format";

const TZ = "America/Cuiaba";
const parts = (d: Date, o: Intl.DateTimeFormatOptions): Record<string, string> => {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hourCycle: "h23", ...o }).formatToParts(d)) p[x.type] = x.value.replace(/\.$/, "");
  return p;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "03 nov 2026 09:14". */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = parts(new Date(iso), { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`;
}
/** "09 nov 2026". */
export function dayYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = parts(new Date(iso), { day: "2-digit", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}`;
}
/** "ter, 10 nov" para um dia `AAAA-MM-DD` da série diária. */
export function weekdayDay(day: string): string {
  const p = parts(new Date(`${day}T12:00:00-04:00`), { weekday: "short", day: "2-digit", month: "short" });
  return `${p.weekday}, ${p.day} ${p.month}`;
}
/** "Novembro de 2026 · atualizado às 08:42". */
export function monthCaption(now: Date = new Date()): string {
  const p = parts(now, { month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `${cap(p.month)} de ${p.year} · atualizado às ${p.hour}:${p.minute}`;
}
/** "sáb, 14 mar 2027 16:30 → dom 02:00" (o fim leva o dia da semana quando cai em outro dia). */
export function eventSpan(startIso: string, endIso: string | null | undefined): string {
  const s = parts(new Date(startIso), { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const start = `${s.weekday}, ${s.day} ${s.month} ${s.year} ${s.hour}:${s.minute}`;
  if (!endIso) return start;
  const e = parts(new Date(endIso), { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const sameDay = e.day === s.day && e.month === s.month && e.year === s.year;
  return `${start} → ${sameDay ? "" : `${e.weekday} `}${e.hour}:${e.minute}`;
}
/** Dia (AAAA-MM-DD) de hoje no fuso de Cuiabá e o começo desse dia, N-1 dias atrás, como instante (para a janela da série). */
export function windowFromDays(days: number, now: Date = new Date()): { from: string; to: string } {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const start = new Date(`${today}T00:00:00-04:00`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: start.toISOString(), to: new Date(now.getTime() + 60_000).toISOString() };
}

/** Altura (%) de cada valor da série em relação ao maior; a maior barra fica destacada. Zero fica em 0%. */
export function barsOf(values: number[]): { pct: number; label?: string; on?: boolean }[] {
  const max = Math.max(0, ...values);
  return values.map((v, i) => ({ pct: max > 0 ? Math.round((v / max) * 100) : 0, label: (i + 1) % 5 === 0 ? String(i + 1) : undefined, on: max > 0 && v === max && values.indexOf(max) === i }));
}

/** Falha do dia "acima do normal": pelo menos 10 e o dobro da média do período. */
export function failureSpike(value: number, all: number[]): boolean {
  if (!all.length) return false;
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  return value >= 10 && value >= 2 * avg;
}

const ACTOR: Record<string, string> = { master: "master", support: "suporte", auditor: "auditoria", organizador: "organizador", convidado: "convidado", sistema: "sistema", system: "sistema", operador: "operador" };
const AUDIT: Record<string, { title: string; tone: "ok" | "bad" }> = {
  "admin.reveal_now": { title: "Revelação antecipada pelo master", tone: "ok" },
  "reveal.now": { title: "Revelação antecipada pelo anfitrião", tone: "ok" },
  "reveal.released": { title: "Revelação liberada", tone: "ok" },
  "reveal.configured": { title: "Revelação configurada", tone: "ok" },
  "admin.set_test_flag": { title: "Marcado como evento de teste", tone: "ok" },
  "admin.unset_test_flag": { title: "Marca de teste removida", tone: "ok" },
  "admin.soft_delete_test_events": { title: "Evento de teste excluído", tone: "bad" },
  "event.deleted": { title: "Evento excluído", tone: "bad" },
  "event.code_rotated": { title: "Código de convite renovado", tone: "ok" },
  "entitlement.courtesy_granted": { title: "Cortesia concedida", tone: "ok" },
  "entitlement.granted": { title: "Plano liberado", tone: "ok" },
  "participant.joined": { title: "Convidado entrou", tone: "ok" },
  "participant.blocked": { title: "Convidado bloqueado", tone: "bad" },
  "participant.unblocked": { title: "Convidado desbloqueado", tone: "ok" },
  "photo.moderated": { title: "Foto moderada", tone: "ok" },
  "photo.access_requested": { title: "Acesso à foto solicitado pelo master", tone: "bad" },
  "consent.recorded": { title: "Consentimento registrado", tone: "ok" },
  "payment.pago": { title: "Pagamento confirmado", tone: "ok" },
  "payment.pendente": { title: "Pagamento pendente", tone: "ok" },
  "payment.falhou": { title: "Pagamento recusado", tone: "bad" },
  "payment.expirado": { title: "Pagamento expirado", tone: "bad" },
  "payment.estornado": { title: "Pagamento estornado", tone: "bad" },
  "payment.refund_requested": { title: "Estorno solicitado", tone: "bad" },
};
export interface AuditItem { at: string; action: string; actorRole: string | null; actorName: string | null; reason: string | null }
/** Linha do tempo da auditoria do evento: título, tom e legenda "08 nov 19:20 · Ana Ribeiro". Ações sem rótulo mostram o código da ação. */
export function auditLine(a: AuditItem): { title: string; tone: "ok" | "bad"; meta: string } {
  const known = AUDIT[a.action];
  const who = a.actorName || (a.actorRole ? ACTOR[a.actorRole] ?? a.actorRole : "sistema");
  const role = a.actorName && a.actorRole && a.actorRole !== "organizador" ? ` (${ACTOR[a.actorRole] ?? a.actorRole})` : "";
  return { title: known?.title ?? a.action, tone: known?.tone ?? "ok", meta: `${relWhen(a.at)} · ${who}${role}` };
}

export const PLAN_SOURCE: Record<string, string> = { cortesia: "cortesia", codigo: "código de cortesia", legado: "plano anterior" };
export const REVEAL_STATE: Record<string, string> = { desativada: "desligada", pendente: "na fila", atrasada: "atrasada", revelada: "revelada" };
export const PRINT_PRODUCT: Record<string, string> = { album: "Álbum", caixa: "Caixa" };
export const PRINT_STATUS: Record<string, { label: string; tone: "ok" | "bad" | "wait" | "info" }> = {
  solicitado: { label: "solicitado", tone: "wait" }, em_producao: { label: "em produção", tone: "info" }, enviado: { label: "enviado", tone: "info" },
  entregue: { label: "entregue", tone: "ok" }, cancelado: { label: "cancelado", tone: "bad" },
};
