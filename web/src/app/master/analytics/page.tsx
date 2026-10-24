import Link from "next/link";
import { includeTests, periodDays, requireMaster, rpc, rpcOr, window, type SearchParams } from "../data";
import { num, pct } from "@/features/master/format";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Funnel } from "../kit/Funnel";
import { Kpi } from "../kit/Kpi";
import { PeriodTabs } from "../kit/PeriodTabs";
import { TestToggle } from "../kit/TestToggle";
import { hrefWith } from "../kit/url";
import { withShellParams } from "../shell/params";
import { PageHead, StateBox } from "../ui";
import { Bars, Lines } from "./charts";
import { cohortEvent, cohortRange, cohorts, cumulative, fromLegacy, fromOverview, METRICS, metricOf, shortDay, splitPeriods, total, weekLabel, type CohortEvent, type DayPoint } from "./lib";
import styles from "./page.module.css";

const PATH = "/master/analytics";
const PAGE = 100, MAX_PAGES = 10;
type Sb = Awaited<ReturnType<typeof requireMaster>>;
interface Funnel4 { created: number; withParticipant: number; withPhoto: number; revealed: number }

/** Eventos criados desde `sinceMs`, do mais novo ao mais antigo, até MAX_PAGES páginas. */
async function cohortEvents(sb: Sb, sinceMs: number, inc: boolean, v2: boolean): Promise<{ ok: true; items: CohortEvent[]; truncated: boolean } | { ok: false }> {
  const items: CohortEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = v2
      ? await rpc<{ items: Record<string, unknown>[] }>(sb, "admin_list_events_v2", { p_limit: PAGE, p_offset: page * PAGE, p_include_tests: inc, p_sort: "createdAt", p_dir: "desc" })
      : await rpc<{ items: Record<string, unknown>[] }>(sb, "admin_list_events", { p_limit: PAGE, p_offset: page * PAGE });
    if (r.state !== "ok") return { ok: false };
    const got = (r.data.items ?? []).map(cohortEvent);
    items.push(...got);
    const oldest = got.length ? Date.parse(got[got.length - 1].createdAt) : 0;
    if (got.length < PAGE || oldest < sinceMs) return { ok: true, items, truncated: false };
  }
  return { ok: true, items, truncated: true };
}

export default async function Analytics({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const days = periodDays(sp), inc = includeTests(sp), metric = metricOf(sp.m);

  // Série de 2N dias: a metade mais recente é o período atual, a outra é o anterior de mesmo tamanho.
  const r = await rpcOr<{ series: unknown }>(sb, "admin_overview", { p_days: days * 2, p_include_tests: inc },
    { name: "admin_dashboard_metrics", args: window(days * 2), map: (d) => ({ series: (d as { series?: unknown })?.series }) });
  const degraded = r.state === "ok" && !!r.degraded;
  const series: DayPoint[] = r.state !== "ok" ? [] : degraded ? fromLegacy(r.data.series) : fromOverview(r.data.series);

  const { weeks, sinceMs: since } = cohortRange(days);
  const [f, ce] = await Promise.all([
    r.state === "ok" && !degraded ? rpc<{ funnel: Funnel4 }>(sb, "admin_overview", { p_days: days, p_include_tests: inc }) : Promise.resolve(null),
    r.state === "ok" ? cohortEvents(sb, since, inc, !degraded) : Promise.resolve(null),
  ]);

  const { current, previous } = splitPeriods(series, days);
  const labels = current.map((d) => shortDay(d.day));
  const mLabel = METRICS.find((x) => x.key === metric)!.label;
  const rows = ce?.ok ? cohorts(ce.items, weeks) : [];
  const empty = current.every((d) => d.photos + d.joins + d.eventsCreated === 0);

  return (
    <>
      <PageHead titulo="Analytics" texto={`Últimos ${days} dias contra os ${days} dias anteriores. Dia local de Cuiabá, calculado no banco.`}
        acao={<div className={styles.controls}><TestToggle path={PATH} params={sp} /><PeriodTabs path={PATH} params={sp} /></div>} />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco. Até lá, o filtro de testes e o funil ficam indisponíveis.</p>}
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <div className={styles.kpis}>
            {METRICS.map((x) => (
              <Kpi key={x.key} label={x.label} value={num(total(current, x.key))} current={total(current, x.key)} previous={total(previous, x.key)}
                spark={current.map((d) => d[x.key])} note={`Anterior: ${num(total(previous, x.key))}`} />
            ))}
          </div>

          <nav className={`adm-tabs ${styles.metricTabs}`} aria-label="Métrica dos gráficos">
            {METRICS.map((x) => <Link key={x.key} className="adm-btn" href={hrefWith(PATH, sp, { m: x.key === "photos" ? null : x.key })} aria-current={x.key === metric ? "page" : undefined}>{x.label}</Link>)}
          </nav>

          {empty ? (
            <EmptyState title="Sem atividade no período" text={inc ? "Nenhum evento, entrada ou foto nestes dias." : "Nenhum evento, entrada ou foto nestes dias. Eventos de teste estão ocultos."}
              action={days < 90 ? { href: hrefWith(PATH, sp, { dias: "90" }), label: "Ver 90 dias" } : undefined} />
          ) : (
            <div className={styles.charts}>
              <Bars title={`${mLabel} por dia`} name={mLabel} labels={labels} values={current.map((d) => d[metric])} />
              <Lines title={`${mLabel} acumulado: atual x anterior`} labels={labels}
                note={`Dia a dia do período atual contra o mesmo dia relativo dos ${days} dias anteriores.`}
                series={[
                  { name: "Período atual", values: cumulative(current.map((d) => d[metric])), color: 1 },
                  { name: "Período anterior", values: cumulative(previous.map((d) => d[metric])), color: 2, dashed: true },
                ]} />
            </div>
          )}
          <div className={styles.controls}>
            <CsvButton filename={`analytics-${days}d`} label="Exportar série (CSV)" rows={current}
              cols={[{ key: "day", label: "Dia" }, { key: "eventsCreated", label: "Eventos criados" }, { key: "joins", label: "Entradas" }, { key: "photos", label: "Fotos" }]} />
          </div>

          <div className={styles.section}><div><h2>Funil de eventos</h2><p>Eventos criados no período e até onde chegaram.</p></div></div>
          {f && f.state === "ok" && f.data.funnel ? (
            <div className={styles.card}>
              <Funnel steps={[
                { label: "Criados", value: f.data.funnel.created },
                { label: "Com participante", value: f.data.funnel.withParticipant },
                { label: "Com foto", value: f.data.funnel.withPhoto },
                { label: "Revelados", value: f.data.funnel.revealed },
              ]} />
            </div>
          ) : f && f.state !== "ok" ? <StateBox load={f} /> : <EmptyState title="Funil indisponível" text="O funil usa a consulta nova do banco. Ele aparece depois da atualização." />}

          <div className={styles.section}>
            <div><h2>Coortes semanais</h2><p>Eventos agrupados pela semana em que foram criados (segunda a domingo) e quantos já tiveram participante e foto.</p></div>
            {rows.length > 0 && (
              <CsvButton filename={`coortes-${days}d`} label="Exportar coortes (CSV)" rows={rows}
                cols={[{ key: "week", label: "Semana (segunda)" }, { key: "created", label: "Criados" }, { key: "withParticipant", label: "Com participante" }, { key: "withPhoto", label: "Com foto" }]} />
            )}
          </div>
          {ce && !ce.ok ? <StateBox load={{ state: "error", message: "lista de eventos indisponível" }} /> : rows.every((x) => x.created === 0) ? (
            <EmptyState title="Nenhum evento criado nestas semanas" text="As coortes aparecem quando houver eventos novos." action={{ href: withShellParams("/master/eventos", sp), label: "Ver eventos" }} />
          ) : (
            <>
              {degraded && <p className="adm-aviso-degradado">Sem a atualização do banco, as coortes incluem eventos de teste.</p>}
              {ce?.ok && ce.truncated && <p className="adm-aviso-degradado">Mostrando os {num(PAGE * MAX_PAGES)} eventos mais recentes; semanas antigas podem estar incompletas.</p>}
              <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Coortes semanais">
                <table className="adm-table">
                  <thead><tr><th scope="col">Semana</th><th scope="col" className="num">Criados</th><th scope="col" className="num">Com participante</th><th scope="col" className="num">Com foto</th></tr></thead>
                  <tbody>
                    {[...rows].reverse().map((x) => (
                      <tr key={x.week}>
                        <th scope="row">{weekLabel(x.week)}</th>
                        <td className="num">{num(x.created)}</td>
                        <td className="num"><span className={styles.cell}>{num(x.withParticipant)}<small>{pct(x.withParticipant, x.created)}</small></span></td>
                        <td className="num"><span className={styles.cell}>{num(x.withPhoto)}<small>{pct(x.withPhoto, x.created)}</small></span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
