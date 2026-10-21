import Link from "next/link";
import { num, requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table } from "../ui";

interface Ev { id: string; title: string; hostName: string; status: string; startAt: string; revealState: string; participants: number; photos: number; failedUploads: number; capacity: number | null }
interface Page { total: number; limit: number; offset: number; items: Ev[] }
const POR_PAGINA = 25;

export default async function Eventos({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; p?: string }> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const status = sp.status === "ativo" || sp.status === "encerrado" ? sp.status : undefined;
  const p = Math.max(1, Number(sp.p) || 1);
  const r = await rpc<Page>(sb, "admin_list_events", { p_limit: POR_PAGINA, p_offset: (p - 1) * POR_PAGINA, p_search: sp.q?.slice(0, 80) || null, p_status: status ?? null });
  const qs = (o: Record<string, string | undefined>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ q: sp.q, status, ...o })) if (v) u.set(k, v); return `/master/eventos?${u}`; };
  return (
    <>
      <PageHead titulo="Eventos" texto="Metadados e contagens. Fotos privadas não aparecem aqui." />
      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="search">
        <label className="mm-field-label" htmlFor="q" style={{ position: "absolute", left: -9999 }}>Buscar</label>
        <input id="q" name="q" className="mm-field-input" placeholder="Nome do evento ou do anfitrião" defaultValue={sp.q} style={{ maxWidth: 320 }} />
        <select name="status" className="mm-field-input" defaultValue={status ?? ""} aria-label="Situação" style={{ maxWidth: 180 }}><option value="">Todos</option><option value="ativo">Ativos</option><option value="encerrado">Encerrados</option></select>
        <button className="mm-btn mm-btn--secundario" type="submit">Filtrar</button>
      </form>
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <Table vazio="Nenhum evento encontrado." cols={[{ k: "t", h: "Evento" }, { k: "h", h: "Anfitrião" }, { k: "s", h: "Situação" }, { k: "r", h: "Revelação" }, { k: "p", h: "Convidados", num: true }, { k: "f", h: "Fotos", num: true }, { k: "x", h: "Falhas", num: true }, { k: "d", h: "Início" }]}
            rows={r.data.items.map((e) => ({ t: e.title, h: e.hostName, s: <Badge s={e.status === "ativo" ? "ok" : "info"}>{e.status}</Badge>, r: <Badge s={e.revealState === "atrasada" ? "erro" : e.revealState === "pendente" ? "aviso" : e.revealState === "revelada" ? "ok" : "info"}>{e.revealState}</Badge>, p: `${num(e.participants)}${e.capacity ? ` / ${num(e.capacity)}` : ""}`, f: num(e.photos), x: num(e.failedUploads), d: when(e.startAt) }))} />
          <nav aria-label="Paginação" style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
            {p > 1 && <Link href={qs({ p: String(p - 1) })}>← Anterior</Link>}
            <span>Página {p} de {Math.max(1, Math.ceil(r.data.total / POR_PAGINA))} · {num(r.data.total)} eventos</span>
            {p * POR_PAGINA < r.data.total && <Link href={qs({ p: String(p + 1) })}>Próxima →</Link>}
          </nav>
        </>
      )}
    </>
  );
}
