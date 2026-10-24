import { includeTests, periodDays, requireMaster, rpcOr, window, type SearchParams } from "./data";
import { PeriodTabs } from "./kit/PeriodTabs";
import { TestToggle } from "./kit/TestToggle";
import { PageHead, StateBox } from "./ui";
import { CATALOG_CAPACITIES, toEventPage } from "./eventos/lib";
import { attention, overviewFromLegacy, toOverview } from "./visao/lib";
import { Activity, Attention, EventFunnel, Kpis, Readiness, Routines, Storage, UpcomingReveals } from "./visao/sections";
import css from "./visao/page.module.css";

const PATH = "/master";
const agora = () => Date.now();

export default async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const dias = periodDays(sp);
  const testes = includeTests(sp);
  const [ov, evs] = await Promise.all([
    rpcOr(sb, "admin_overview", { p_days: dias, p_include_tests: testes }, { name: "admin_dashboard_metrics", args: window(dias), map: (d) => overviewFromLegacy(d, dias) }),
    rpcOr<unknown>(sb, "admin_list_events_v2",
      { p_limit: 100, p_offset: 0, p_search: null, p_status: null, p_include_tests: testes, p_sort: "createdAt", p_dir: "desc" },
      { name: "admin_list_events", args: { p_limit: 100, p_offset: 0 } }),
  ]);
  const now = agora();
  const degraded = ov.state === "ok" && !!ov.degraded;
  const o = ov.state === "ok" ? (degraded ? ov.data : toOverview(ov.data)) : null;
  const risky = evs.state === "ok" ? attention(toEventPage(evs.data).items, now, CATALOG_CAPACITIES) : [];

  return (
    <>
      <PageHead titulo="Visão geral" texto={`Indicadores da plataforma nos últimos ${dias} dias${testes ? ", com eventos de teste" : ", sem eventos de teste"}.`}
        acao={<div className={css.headActions}><TestToggle path={PATH} params={sp} /><PeriodTabs path={PATH} params={sp} /></div>} />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco.</p>}
      {!o ? <StateBox load={ov} /> : (
        <>
          <Kpis o={o} />
          {!degraded && <Readiness r={o.readiness} sp={sp} />}
          {!degraded && <Activity o={o} />}
          {!degraded && (
            <div className={css.grid2}>
              {o.funnel && <EventFunnel f={o.funnel} />}
              <UpcomingReveals items={o.upcomingReveals} now={now} sp={sp} />
              <Routines jobs={o.jobs} sp={sp} />
              {o.storage && <Storage s={o.storage} sp={sp} />}
            </div>
          )}
        </>
      )}
      {evs.state !== "ok" ? <StateBox load={evs} /> : <Attention rows={risky} sp={sp} testsHidden={!testes && !(evs.degraded ?? false)} />}
    </>
  );
}
