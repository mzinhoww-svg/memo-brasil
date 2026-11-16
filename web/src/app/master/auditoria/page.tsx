import { AUDIT_CATEGORIES, PER_PAGE, auditCategory, auditHref, auditRow, pageList, rangeText, type AuditItem } from "@/lib/master/audit";
import { MasterAuditoriaFiltrosEstado, MasterAuditoriaFiltrosView, AuditFilters } from "@/revela/screens/MasterAuditoriaFiltros";
import { ExportSheetCustomButton } from "../ExportSheetCustomButton";
import { requireRole, rpc } from "../data";
import { nowMs } from "../format";
import { AuditEventFilter } from "./AuditEventFilter";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** M28 · Auditoria com filtros: por categoria (participante, consentimento, revelação, admin, pagamento) e por evento, 25 por página.
 *  Só master e auditor abrem (support recebe a tela de acesso limitado). O e-mail do autor chega mascarado do servidor quando quem lê é o auditor. */
export default async function Auditoria({ searchParams }: { searchParams: Promise<{ cat?: string; evento?: string; p?: string }> }) {
  const gate = await requireRole("auditoria");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const sp = await searchParams;
  const cat = auditCategory(sp.cat);
  const evento = sp.evento && UUID.test(sp.evento) ? sp.evento : null;
  const page = Math.max(1, Math.floor(Number(sp.p)) || 1);
  const [r, ev] = await Promise.all([
    rpc<{ total: number; items: AuditItem[] }>(sb, "admin_list_audit_v2", { p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE, p_category: cat === "todas" ? null : cat, p_event: evento }),
    rpc<{ id: string; title: string }[]>(sb, "admin_audit_events", { p_limit: 200 }),
  ]);
  if (r.state !== "ok") return <MasterAuditoriaFiltrosEstado variant={r.state === "denied" ? "denied" : "error"} exportAction={null} />;
  const events = ev.state === "ok" ? ev.data : [];
  const eventTitle = events.find((e) => e.id === evento)?.title;
  const catLabel = AUDIT_CATEGORIES.find((c) => c.id === cat)?.label ?? "Todas";
  const exportAction = (
    <ExportSheetCustomButton custom="auditoria" screen="auditoria" screenLabel="Auditoria" period="Todo o histórico" rowsEstimate={r.data.total}
      filters={{ categoria: cat, evento }} filtersText={`Categoria: ${catLabel} · Evento: ${eventTitle ?? "todos"}`} />
  );
  const catHref = (c: typeof cat) => auditHref({ cat: c, evento: evento ?? undefined });
  const eventField = <AuditEventFilter events={events} selected={evento} cat={cat} />;
  if (r.data.items.length === 0 && r.data.total === 0) {
    return <MasterAuditoriaFiltrosEstado variant="empty" exportAction={exportAction} filters={<AuditFilters cat={cat} catHref={catHref} eventField={eventField} />} />;
  }
  const last = Math.max(1, Math.ceil(r.data.total / PER_PAGE));
  const now = new Date(nowMs());
  return (
    <MasterAuditoriaFiltrosView
      exportAction={exportAction} cat={cat} catHref={catHref} eventField={eventField} rows={r.data.items.map((x) => auditRow(x, now))}
      pager={{ range: rangeText(page, r.data.total), pages: pageList(page, last), page, flow: true, hrefOf: (n) => auditHref({ cat, evento: evento ?? undefined, p: n }),
        prevHref: page > 1 ? auditHref({ cat, evento: evento ?? undefined, p: page - 1 }) : null, nextHref: page < last ? auditHref({ cat, evento: evento ?? undefined, p: page + 1 }) : null }}
    />
  );
}
