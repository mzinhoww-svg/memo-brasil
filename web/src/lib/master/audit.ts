/** Auditoria do Master (M28): categorias, rótulos das ações e a linha da tabela. O servidor (RPC `admin_list_audit_v2`) já entrega o e-mail do autor
 *  mascarado para quem não é master; aqui só se formata. */
import { relWhen } from "@/app/master/format";

export const AUDIT_CATEGORIES = [
  { id: "todas", label: "Todas" },
  { id: "participante", label: "Participante" },
  { id: "consentimento", label: "Consentimento" },
  { id: "revelacao", label: "Revelação" },
  { id: "admin", label: "Admin" },
  { id: "pagamento", label: "Pagamento" },
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["id"];
export const auditCategory = (v: string | undefined): AuditCategory => AUDIT_CATEGORIES.find((c) => c.id === v)?.id ?? "todas";
export const PER_PAGE = 25;

export interface AuditItem {
  id: number; at: string; actorId: string | null; actorRole: string | null; actorEmail?: string | null; eventId?: string | null; action: string;
  targetType: string | null; targetId: string | null; targetLabel?: string | null; exportRows?: number | null; reason: string | null; eventTitle?: string | null;
}

/** Ações em português; o que não está na lista aparece como o código gravado. */
export const ACTION_LABEL: Record<string, string> = {
  "plan.price_changed": "Preço de plano alterado", "plan.updated": "Plano alterado",
  "admin.reconcile": "Conciliação manual", "admin.reveal_now": "Revelação antecipada", "admin.set_test_flag": "Evento marcado como teste", "admin.unset_test_flag": "Evento desmarcado como teste",
  "admin.soft_delete_test_events": "Evento de teste excluído", "entitlement.courtesy_granted": "Cortesia concedida", "courtesy.created": "Cortesia criada",
  "code.created": "Cortesia criada", "code.revoked": "Cortesia revogada", "code.redeemed": "Cortesia usada", "payment.refund_requested": "Estorno pedido", "payment.estornado": "Pagamento estornado",
  "payment.needs_refund_cleared": "Estorno resolvido", "payment.pendente": "Pagamento pendente", "payment.criado": "Pagamento criado", "payment.expirado": "Pagamento expirado", "payment.falhou": "Pagamento falhou",
  "platform_role.granted": "Papel concedido", "platform_role.revoked": "Papel revogado", "export.csv": "Exportação", "photo.hidden": "Foto escondida", "photo.kept": "Foto mantida",
  "photo.removed": "Foto excluída", "photo.moderated": "Foto moderada", "photo.access_requested": "Acesso a foto pedido", "comment.esconder": "Comentário escondido", "comment.mostrar": "Comentário mantido",
  "comment.remover": "Comentário excluído", "participant.joined": "Convidado entrou", "participant.blocked": "Convidado bloqueado", "participant.unblocked": "Convidado desbloqueado",
  "consent.recorded": "Consentimento registrado", "reveal.released": "Revelação feita", "reveal.configured": "Revelação configurada", "reveal.now": "Revelação antecipada",
  "account.deletion_requested": "Exclusão de conta pedida", "account.deleted": "Conta excluída", "invitation.created": "Convite criado", "invitation.revoked": "Convite revogado",
  "platform_settings.update": "Configuração alterada", "platform_settings.insert": "Configuração criada", "feature_flags.update": "Chave alterada", "feature_flags.insert": "Chave criada",
};
export const actionLabel = (a: string): string => ACTION_LABEL[a] ?? a;

const KIND_LABEL: Record<string, string> = { visao: "Visão geral", eventos: "Eventos", pagamentos: "Pagamentos", pessoas: "Pessoas", auditoria: "Auditoria", impressoes: "Impressões", moderacao: "Moderação" };

/** Alvo legível: título do evento, plano, e-mail (já mascarado pelo servidor), código; exportação vira "Pagamentos · 74 linhas". */
export function targetText(x: Pick<AuditItem, "action" | "targetType" | "targetId" | "targetLabel" | "exportRows" | "eventTitle">): string {
  if (x.action === "export.csv") {
    const k = KIND_LABEL[x.targetId ?? ""] ?? x.targetId ?? "—";
    return x.exportRows != null ? `${k} · ${x.exportRows} ${x.exportRows === 1 ? "linha" : "linhas"}` : k;
  }
  if (x.targetLabel) return x.targetLabel;
  if (x.targetType === "event" && x.eventTitle) return x.eventTitle;
  if (x.targetType === "code" && x.targetId) return x.targetId;
  if (x.targetType === "photo" && x.targetId) return `foto ${x.targetId.replace(/-/g, "").slice(0, 4)}…`;
  if (x.targetType === "platform_settings" || x.targetType === "feature_flags") return x.targetId ?? "—";
  if (x.targetId) return x.targetId.length > 24 ? `${x.targetId.slice(0, 8)}…` : x.targetId;
  return x.eventTitle ?? "—";
}

const ROLE_WHO: Record<string, string> = { sistema: "sistema", system: "sistema" };
export const actorText = (x: Pick<AuditItem, "actorId" | "actorRole" | "actorEmail">): string =>
  x.actorEmail ?? (x.actorRole && ROLE_WHO[x.actorRole]) ?? (x.actorId ? `conta ${x.actorId.slice(0, 8)}…` : "sistema");

/** Resumo do motivo: uma linha, até 90 caracteres; vazio vira "—". */
export function reasonSummary(reason: string | null | undefined, max = 90): string {
  const r = (reason ?? "").replace(/\s+/g, " ").trim();
  if (!r) return "—";
  return r.length > max ? `${r.slice(0, max - 1).trimEnd()}…` : r;
}

export interface AuditRowText { key: string; when: string; who: string; action: string; target: string; reason: string }
export function auditRow(x: AuditItem, now: Date = new Date()): AuditRowText {
  return { key: String(x.id), when: relWhen(x.at, now), who: actorText(x), action: actionLabel(x.action), target: targetText(x), reason: reasonSummary(x.reason) };
}

/** Páginas da barra: 1 2 3 … 78 (a atual em destaque). */
export function pageList(page: number, last: number): (number | "…")[] {
  if (last <= 5) return Array.from({ length: last }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, last].filter((n) => n <= last));
  if (page > 2 && page < last) { set.add(page - 1); set.add(page); set.add(page + 1); }
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of [...set].sort((a, b) => a - b)) { if (n - prev > 1) out.push("…"); out.push(n); prev = n; }
  return out;
}

const nf = new Intl.NumberFormat("pt-BR");
/** "1–25 de 1.932 · 25 por página". */
export function rangeText(page: number, total: number, per = PER_PAGE): string {
  const from = total ? (page - 1) * per + 1 : 0;
  return `${nf.format(from)}–${nf.format(Math.min(total, page * per))} de ${nf.format(total)} · ${per} por página`;
}

export function auditHref(o: { cat?: string; evento?: string; p?: number }): string {
  const q = new URLSearchParams();
  if (o.cat && o.cat !== "todas") q.set("cat", o.cat);
  if (o.evento) q.set("evento", o.evento);
  if (o.p && o.p > 1) q.set("p", String(o.p));
  const s = q.toString();
  return s ? `/master/auditoria?${s}` : "/master/auditoria";
}
