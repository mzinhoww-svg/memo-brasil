import { MasterEventosView, type EventoRow } from "@/revela/screens/MasterEventos";
import { ExportButton } from "../ExportButton";
import { MState } from "@/revela/master-kit";
import { requireMaster, rpc } from "../data";
import { CATEGORY, nf, revealShort } from "../format";

interface Ev {
  id: string; title: string; hostName: string; category: string; planCode: string | null; planName: string | null; participants: number; capacity: number | null; photos: number;
  reports: number; revealEnabled: boolean; revealAt: string | null; revealedAt: string | null; live: boolean; deletedAt: string | null;
}
interface Board { total: number; counts: { todos: number; rolando: number; aguardando: number; revelados: number; denuncias: number; excluidos: number }; items: Ev[] }
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

export default async function Eventos({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; p?: string }> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const filtro = FILTROS.some(([k]) => k && k === sp.f) ? sp.f! : "";
  const p = Math.max(1, Number(sp.p) || 1);
  const r = await rpc<Board>(sb, "admin_events_board", { p_filter: filtro || null, p_search: sp.q?.slice(0, 80) || null, p_limit: POR_PAGINA, p_offset: (p - 1) * POR_PAGINA });
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const href = (o: { f?: string; p?: number }) => {
    const u = new URLSearchParams();
    if (sp.q) u.set("q", sp.q);
    const f = o.f ?? filtro;
    if (f) u.set("f", f);
    if (o.p && o.p > 1) u.set("p", String(o.p));
    const s = u.toString();
    return `/master/eventos${s ? `?${s}` : ""}`;
  };
  const rows: EventoRow[] = r.data.items.map((e) => {
    const s = situacao(e);
    return {
      key: e.id, title: e.title, host: e.hostName || "—", category: CATEGORY[e.category] ?? e.category, plan: e.planName ?? e.planCode ?? "Grátis",
      guests: `${nf(e.participants)}${e.capacity ? ` / ${nf(e.capacity)}` : ""}`, photos: nf(e.photos),
      reveal: e.revealedAt ? "revelado" : e.revealEnabled ? revealShort(e.revealAt) : "—", tone: s.tone, status: s.label,
    };
  });
  const c = r.data.counts;
  const last = Math.max(1, Math.ceil(r.data.total / POR_PAGINA));
  return (
    <MasterEventosView
      caption={`${nf(c.todos)} eventos · ${nf(c.rolando)} rolando agora${sp.q ? ` · busca "${sp.q}"` : ""}`}
      chips={FILTROS.map(([k, label]) => ({ label, href: href({ f: k, p: 1 }), on: k === filtro }))}
      rows={rows} exportAction={<ExportButton kind="eventos" screen="eventos" filters={{ f: filtro, q: sp.q?.slice(0, 80) }} />}
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
