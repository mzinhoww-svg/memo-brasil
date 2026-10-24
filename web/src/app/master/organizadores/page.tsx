import { includeTests, num, requireMaster, rpc, when } from "../data";
import type { SearchParams } from "../data";
import { PageHead, StateBox } from "../ui";
import { brl } from "@/features/master/format";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Kpi } from "../kit/Kpi";
import { Pill } from "../kit/Pill";
import { TestToggle } from "../kit/TestToggle";
import { Pager } from "../usuarios/Pager";
import { pageCount, parsePage } from "../usuarios/lib";
import { loadEvents } from "./events";
import { aggregateByHost, collectPages, mergeOrganizers, type Funnel4, type OrderLite, type OrgListItem, type OrgRow } from "./lib";
import s from "./page.module.css";

const PATH = "/master/organizadores";
const PER_PAGE = 25;
const SO_MASTER = "Só master";

export default async function Organizadores({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const tests = includeTests(sp), page = parsePage(sp);

  const [list, ev, pay] = await Promise.all([
    collectPages<OrgListItem>(async (offset) => {
      const r = await rpc<{ total: number; items: OrgListItem[] }>(sb, "admin_list_organizers", { p_limit: 100, p_offset: offset });
      return r.state === "ok" ? { ok: true, total: r.data.total, items: r.data.items } : { ok: false };
    }, 100, 1000),
    loadEvents(sb, tests),
    rpc<{ orderId?: string; eventId: string | null; status: string; amountCents: number }[]>(sb, "admin_list_payments", { p_limit: 500 }),
  ]);

  if (list.failed) return (<><PageHead titulo="Organizadores" /><StateBox load={{ state: "error", message: "lista de organizadores indisponível" }} /></>);

  const orders: OrderLite[] | null = pay.state === "ok" ? pay.data : null;
  const aggs = ev ? aggregateByHost(ev.events, orders, { includeTests: tests }) : null;
  const rows = mergeOrganizers(list.items, aggs, { hideEmpty: !!ev && !ev.degraded && !ev.truncated && !tests });
  const degraded = !ev || ev.degraded;
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const totals = rows.reduce((t, r) => ({ events: t.events + r.events, participants: t.participants + r.participants, photos: t.photos + r.photos, revenue: t.revenue + (r.revenueCents ?? 0) }), { events: 0, participants: 0, photos: 0, revenue: 0 });
  const csvRows = rows.map((r) => ({
    nome: r.name, email: r.email ?? "", eventos: r.events, participantes: r.participants, fotos: r.photos, plano: r.topPlan ?? "",
    receita: r.revenueCents == null ? SO_MASTER : (r.revenueCents / 100).toFixed(2).replace(".", ","),
    criados: r.funnel.created, comParticipante: r.funnel.withParticipant, comFoto: r.funnel.withPhoto, revelados: r.funnel.revealed,
    ultimo: r.lastEventAt ?? "", lgpd: r.deletionRequested ? "exclusao pedida" : "",
  }));
  const csvCols = [
    { key: "nome", label: "Nome" }, { key: "email", label: "E-mail" }, { key: "eventos", label: "Eventos" }, { key: "participantes", label: "Participantes" },
    { key: "fotos", label: "Fotos" }, { key: "plano", label: "Plano mais usado" }, { key: "receita", label: "Receita (R$)" },
    { key: "criados", label: "Funil: criados" }, { key: "comParticipante", label: "Funil: com participante" }, { key: "comFoto", label: "Funil: com foto" }, { key: "revelados", label: "Funil: revelados" },
    { key: "ultimo", label: "Último evento" }, { key: "lgpd", label: "LGPD" },
  ] as const;

  return (
    <>
      <PageHead titulo="Organizadores" texto="Quem cria eventos, quanto eles movimentam e onde o funil trava. E-mails mascarados, exceto para master." acao={<TestToggle path={PATH} params={sp} />} />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco. Por ora: sem plano mais usado nem filtro de testes.</p>}
      {ev?.truncated && <p className="adm-aviso-degradado">Mostrando só os primeiros {num(ev.events.length)} eventos; totais por organizador podem estar incompletos.</p>}
      <div className={s.kpis}>
        <Kpi label="Organizadores" value={num(rows.length)} />
        <Kpi label="Eventos" value={num(totals.events)} />
        <Kpi label="Participantes" value={num(totals.participants)} />
        <Kpi label="Fotos" value={num(totals.photos)} />
        <Kpi label="Receita" value={orders ? brl(totals.revenue) : SO_MASTER} note={orders ? "Pedidos pagos recentes" : undefined} />
      </div>
      <div className={s.tools}><CsvButton filename="organizadores" rows={csvRows} cols={csvCols} /></div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum organizador" text={tests ? "Ainda não há eventos criados." : "Nenhum organizador com evento real. Mostre os testes para ver o restante."} action={tests ? undefined : { href: `${PATH}?testes=1`, label: "Mostrar testes" }} />
      ) : (
        <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Organizadores">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Organizador</th><th scope="col" className="num">Eventos</th><th scope="col" className="num">Participantes</th>
                <th scope="col" className="num">Fotos</th><th scope="col">Plano mais usado</th><th scope="col" className="num">Receita</th>
                <th scope="col">Funil (criados, com convidados, com fotos, revelados)</th><th scope="col">Último evento</th>
              </tr>
            </thead>
            <tbody>{shown.map((r) => <Row key={r.hostId} r={r} master={orders != null} degraded={degraded} />)}</tbody>
          </table>
        </div>
      )}
      <Pager path={PATH} params={sp} page={page} pages={pageCount(rows.length, PER_PAGE)} total={num(rows.length)} noun="organizadores" />
    </>
  );
}

function MiniFunnel({ f }: { f: Funnel4 }) {
  const top = f.created || 1;
  const vals = [f.created, f.withParticipant, f.withPhoto, f.revealed];
  const label = `${f.created} criados, ${f.withParticipant} com convidados, ${f.withPhoto} com fotos, ${f.revealed} revelados`;
  return (
    <span role="img" aria-label={label} title={label}>
      <span className={s.mini} aria-hidden="true">{vals.map((v, i) => <i key={i} style={{ height: `${Math.max(8, (v / top) * 100)}%`, opacity: v === 0 ? 0.35 : 1 }} />)}</span>
      <span className={s.miniTxt} aria-hidden="true">{vals.join(" / ")}</span>
    </span>
  );
}

function Row({ r, master, degraded }: { r: OrgRow; master: boolean; degraded: boolean }) {
  return (
    <tr>
      <td>
        <strong>{r.name || "Sem nome"}</strong>
        <div className="adm-nota">{r.email ?? "—"}</div>
        {r.deletionRequested && <Pill tone="warn">exclusão pedida</Pill>}
      </td>
      <td className="num">{num(r.events)}</td>
      <td className="num">{num(r.participants)}</td>
      <td className="num">{num(r.photos)}</td>
      <td>{r.topPlan ?? (degraded ? "—" : "sem plano")}</td>
      <td className="num">{master && r.revenueCents != null ? brl(r.revenueCents) : <span className={`adm-nota ${s.only}`}>{SO_MASTER}</span>}</td>
      <td><MiniFunnel f={r.funnel} /></td>
      <td>{when(r.lastEventAt)}</td>
    </tr>
  );
}
