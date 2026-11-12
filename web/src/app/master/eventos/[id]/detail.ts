/** `admin_event_detail` → props da M21 (puro, testado). Só números nos avisos por e-mail; denúncias por motivo; impressão só com a chave; auditoria em linha do tempo. */
import type { EventoDetalheProps } from "@/revela/screens/MasterEventoDetalhe";
import { brl } from "../../billing";
import { CATEGORY, methodLabel, nf, plannedWhen } from "../../format";
import { auditLine, eventSpan, PLAN_SOURCE, PRINT_PRODUCT, PRINT_STATUS, REVEAL_STATE, stamp, type AuditItem } from "../../visao-eventos-format";

export interface EventDetail {
  event: {
    id: string; title: string; category: string; hostName: string; status: string; startAt: string; endAt: string | null; createdAt: string; deletedAt: string | null;
    revealEnabled: boolean; revealAt: string | null; revealedAt: string | null; revealState: string; capacity: number | null; isTest: boolean; participants: number; photos: number; failedUploads: number;
  };
  entitlement: { planCode: string; maxGuests: number | null; maxShots: number | null; source: string };
  plan: { code: string; name: string | null; source: string | null; paidCents: number | null; paidMethod: string | null; orderCode: string | null };
  notices: { subscribers: number; sent: number; failed: number; queued: number };
  reportsByReason: { naoQueroAparecer: number; constrangedora: number; improprio: number; outro: number };
  printOrders: { id: string; code: string; product: string; quantity: number; status: string }[];
  audit: (AuditItem & { targetType: string | null; targetId: string | null })[];
}

export function planText(d: EventDetail): string {
  const name = d.plan.name ?? d.plan.code;
  if (d.plan.paidCents) return `${name} · ${brl(d.plan.paidCents)}${d.plan.paidMethod ? ` pago por ${methodLabel(d.plan.paidMethod)}` : " pago"}`;
  const src = d.plan.source ? PLAN_SOURCE[d.plan.source] : undefined;
  return src ? `${name} · ${src}` : name;
}

export function guestsOf(d: EventDetail): { value: string; pct: number } {
  const cap = d.entitlement.maxGuests ?? d.event.capacity;
  return cap ? { value: `${nf(d.event.participants)} de ${nf(cap)}`, pct: Math.min(100, Math.round((d.event.participants / cap) * 100)) } : { value: `${nf(d.event.participants)} (sem limite)`, pct: 0 };
}

export function revealRows(d: EventDetail): { label: string; value: string }[] {
  const n = d.notices;
  return [
    { label: "Prevista", value: d.event.revealEnabled ? plannedWhen(d.event.revealAt) : "—" },
    { label: "Situação", value: REVEAL_STATE[d.event.revealState] ?? d.event.revealState },
    { label: "Avisos por e-mail", value: `${nf(n.subscribers)} ${n.subscribers === 1 ? "inscrito" : "inscritos"}` },
    { label: "Enviados", value: nf(n.sent) },
    { label: "Falhas", value: nf(n.failed) },
    { label: "Na fila", value: nf(n.queued) },
  ];
}

export function reasonRows(d: EventDetail): { label: string; count: number; pct: number }[] {
  const r = d.reportsByReason;
  const list = [["Não quero aparecer", r.naoQueroAparecer], ["Foto constrangedora", r.constrangedora], ["Conteúdo impróprio", r.improprio], ["Outro motivo", r.outro]] as const;
  const max = Math.max(0, ...list.map(([, n]) => n));
  return list.map(([label, count]) => ({ label, count, pct: max > 0 ? Math.round((count / max) * 100) : 0 }));
}

/** `showPrints`: master com a chave `printed_album` ligada. */
export function toDetalheProps(d: EventDetail, host: string, showPrints: boolean): EventoDetalheProps {
  return {
    title: d.event.title,
    caption: [CATEGORY[d.event.category] ?? d.event.category, host || "—", eventSpan(d.event.startAt, d.event.endAt)].join(" · "),
    plan: planText(d), photos: nf(d.event.photos), createdAt: stamp(d.event.createdAt), guests: guestsOf(d), reveal: revealRows(d), reasons: reasonRows(d),
    prints: showPrints ? d.printOrders.map((o) => ({ key: o.id, code: o.code, product: `${PRINT_PRODUCT[o.product] ?? o.product} · ${o.quantity}`, tone: PRINT_STATUS[o.status]?.tone ?? "info", status: PRINT_STATUS[o.status]?.label ?? o.status })) : null,
    timeline: d.audit.slice(0, 8).map((a, i) => ({ key: `${a.at}-${i}`, ...auditLine(a) })),
  };
}
