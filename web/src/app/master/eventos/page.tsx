import { MasterStatePage } from "@/revela/master";
import { MasterEventosView, type EventoRow } from "@/revela/screens/MasterEventos";
import { requireRole, rpc } from "../data";
import { ExportSheetButton } from "../ExportSheetButton";
import { CATEGORY, nf, revealShort } from "../format";
import { TesteLista, type TesteRow } from "./TesteLista";
import { dayYear } from "../visao-eventos-format";

interface Ev {
  id: string; title: string; hostName: string; category: string; planCode: string | null; planName: string | null; participants: number; capacity: number | null; photos: number;
  reports: number; revealEnabled: boolean; revealAt: string | null; revealedAt: string | null; live: boolean; deletedAt: string | null;
}
interface Board { total: number; counts: { todos: number; rolando: number; aguardando: number; revelados: number; denuncias: number; excluidos: number; teste?: number }; items: Ev[] }
interface TestItem { id: string; title: string; hostName: string; hostEmail: string | null; planName: string; payment: string | null; photos: number; createdAt: string; blocked: boolean; blockedReason: string | null }
interface TestList { total: number; allEvents: number; items: TestItem[] }
const POR_PAGINA = 25;
const FILTROS = [["", "Todos"], ["rolando", "Rolando"], ["aguardando", "Aguardando revelação"], ["revelados", "Revelados"], ["denuncias", "Com denúncias"], ["excluidos", "Excluídos"]] as const;

function situacao(e: Ev): { tone: "ok" | "bad" | "wait" | "info"; label: string } {
  if (e.deletedAt) return { tone: "info", label: "Excluído" };
  if (e.reports > 0) return { tone: "bad", label: `${e.reports} ${e.reports === 1 ? "denúncia" : "denúncias"}` };
  if (e.revealedAt) return { tone: "info", label: "Revelado" };
  if (e.capacity && e.participants >= e.capacity * 0.9 && e.live) return { tone: "wait", label: "Quase cheio" };
  if (e.live) return { tone: "ok", label: "Rolando" };
  return { tone: "wait", label: e.revealEnabled ? "Aguardando revelação" : "Encerrado" };
}
const PAYMENT: Record<string, string> = { sandbox: "sandbox", production: "produção" };

/** M02 · Eventos e M22 · Eventos de teste (`?filtro=teste`). Qualquer papel de equipe lê; só o master seleciona, desmarca e exclui teste (o banco confere de novo). */
export default async function Eventos({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string; filtro?: string }> }) {
  const gate = await requireRole("eventos");
  if ("denied" in gate) return gate.denied;
  const { sb, role } = gate;
  const sp = await searchParams;
  const p = Math.max(1, Number(sp.p) || 1);
  const q = sp.q?.slice(0, 80);
  const canExport = role === "master" || role === "auditor";
  const chipsOf = (teste: number, on: string) => [
    ...FILTROS.map(([k, label]) => ({ label, href: k ? `/master/eventos?f=${k}` : "/master/eventos", on: k === on })),
    { label: `De teste ${nf(teste)}`, href: "/master/eventos?filtro=teste", on: on === "teste" },
  ];

  if (sp.filtro === "teste") {
    const r = await rpc<TestList>(sb, "admin_test_events", { p_limit: POR_PAGINA, p_offset: (p - 1) * POR_PAGINA, p_search: q || null });
    if (r.state !== "ok") return <MasterStatePage area="Eventos" variant={r.state === "denied" ? "denied" : "error"} />;
    const caption = `${nf(r.data.allEvents)} eventos · ${nf(r.data.total)} de teste`;
    if (r.data.total === 0) return <MasterStatePage area="Eventos" variant="empty" caption={caption} title="Nenhum evento de teste" text="Marque um evento como teste na página dele." />;
    const rows: TesteRow[] = r.data.items.map((e) => ({
      key: e.id, title: e.title, host: e.hostEmail ?? (e.hostName || "—"), plan: e.planName, payment: e.payment ? PAYMENT[e.payment] ?? e.payment : "—", photos: nf(e.photos), createdAt: dayYear(e.createdAt), href: `/master/eventos/${e.id}`, photosN: e.photos,
    }));
    return <TesteLista caption={caption} chips={chipsOf(r.data.total, "teste")} rows={rows} canSelect={role === "master"} />;
  }

  const filtro = FILTROS.some(([k]) => k && k === sp.f) ? sp.f! : "";
  const r = await rpc<Board>(sb, "admin_events_board", { p_filter: filtro || null, p_search: q || null, p_limit: POR_PAGINA, p_offset: (p - 1) * POR_PAGINA });
  if (r.state !== "ok") return <MasterStatePage area="Eventos" variant={r.state === "denied" ? "denied" : "error"} />;
  const c = r.data.counts;
  if (c.todos + c.excluidos === 0 && !q && !filtro) {
    return <MasterStatePage area="Eventos" variant="empty" caption="0 eventos" title="Nenhum evento ainda" text="Quando alguém criar um evento, ele aparece aqui." />;
  }
  const href = (o: { p?: number }) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (filtro) u.set("f", filtro);
    if (o.p && o.p > 1) u.set("p", String(o.p));
    const s = u.toString();
    return `/master/eventos${s ? `?${s}` : ""}`;
  };
  const rows: EventoRow[] = r.data.items.map((e) => {
    const s = situacao(e);
    return {
      key: e.id, title: e.title, host: e.hostName || "—", category: CATEGORY[e.category] ?? e.category, plan: e.planName ?? e.planCode ?? "Grátis", href: `/master/eventos/${e.id}`,
      guests: `${nf(e.participants)}${e.capacity ? ` / ${nf(e.capacity)}` : ""}`, photos: nf(e.photos),
      reveal: e.revealedAt ? "revelado" : e.revealEnabled ? revealShort(e.revealAt) : "—", tone: s.tone, status: s.label,
    };
  });
  const last = Math.max(1, Math.ceil(r.data.total / POR_PAGINA));
  return (
    <MasterEventosView
      caption={`${nf(c.todos)} eventos · ${nf(c.rolando)} rolando agora${q ? ` · busca "${q}"` : ""}`}
      chips={chipsOf(c.teste ?? 0, filtro)}
      rows={rows}
      exportAction={canExport ? <ExportSheetButton kind="eventos" screen="eventos" screenLabel="Eventos" label="Exportar CSV" filters={{ f: filtro, q }} period="Todo o período"
        filtersText={`Situação: ${FILTROS.find(([k]) => k === filtro)?.[1] ?? "Todos"}${q ? ` · Busca: ${q}` : ""} · sem eventos de teste`} rowsEstimate={r.data.total} /> : null}
      pager={last > 1 ? (
        <nav aria-label="Paginação" className="row" style={{ gap: "12px", marginTop: "16px", alignItems: "center" }}>
          {p > 1 && <a className="link" href={href({ p: p - 1 })}>← Anterior</a>}
          <span className="rv-caption">Página {p} de {last} · {nf(r.data.total)} eventos</span>
          {p < last && <a className="link" href={href({ p: p + 1 })}>Próxima →</a>}
        </nav>
      ) : undefined}
    />
  );
}
