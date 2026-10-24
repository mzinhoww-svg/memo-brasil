import { healthAlerts } from "@/lib/master/health-alerts";
import { num } from "@/features/master/format";
import { requireMaster, rpc, rpcOr } from "../data";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { Metric, PageHead, StateBox } from "../ui";
import { when } from "../eventos/lib";
import { duration, FAIL_STREAK_ALERT, historyFromLegacy, jobView, RUNS_SHOWN, toHistory, type JobView } from "./lib";
import css from "./page.module.css";

interface H { cronAvailable: boolean; jobs: { name: string; schedule: string; active: boolean; lastRun: { startedAt: string; status: string; message: string | null } | null }[]; reveals: { overdue: number; maxDelaySeconds: number }; purgeQueue: { size: number; oldestAgeSeconds: number }; uploads: { stalled: number; failed: number }; lgpd: { pendingDeletions: number } }
const agora = () => new Date();
const STATUS: Record<string, string> = { succeeded: "sucesso", failed: "falhou", running: "em execução", starting: "iniciando" };

function Job({ v }: { v: JobView }) {
  return (
    <li className={css.job} data-alert={v.alert || undefined}>
      <div className={css.jobHead}>
        <h2>{v.name}</h2>
        {!v.active ? <Pill tone="dim">inativa</Pill> : v.alert ? <Pill tone="crit">{num(v.streak)} falhas seguidas</Pill>
          : v.last ? <Pill tone={v.lastTone}>{STATUS[v.last.status] ?? v.last.status}</Pill> : <Pill tone="dim">sem execução</Pill>}
      </div>
      <dl className={css.dl}>
        <dt>Agenda</dt><dd>{v.readable}{v.readable !== v.schedule && <> · <code>{v.schedule}</code></>}</dd>
        <dt>Próxima</dt><dd>{v.next ? when(v.next.toISOString()) : "—"}</dd>
        <dt>Última</dt><dd>{v.last ? `${when(v.last.startedAt)} · ${duration(v.last.durationMs)}` : "—"}</dd>
      </dl>
      {v.squares.length > 0 && (
        <div>
          <ol className={css.squares} aria-label={`Últimas ${v.squares.length} execuções: ${v.squares.filter((s) => s.tone === "crit").length} falhas`}>
            {v.squares.map((s, i) => <li key={i} className={css.sq} data-tone={s.tone} title={`${when(s.run.startedAt)} · ${STATUS[s.run.status] ?? s.run.status} · ${duration(s.run.durationMs)}`} />)}
          </ol>
          <span className={css.legend}>{v.squares.length > 1 ? `Últimas ${num(v.squares.length)}, da mais antiga à mais recente` : "Só a última execução"}</span>
        </div>
      )}
    </li>
  );
}

export default async function Saude() {
  const sb = await requireMaster();
  const [r, hist] = await Promise.all([
    rpc<H>(sb, "admin_health"),
    rpcOr<unknown>(sb, "admin_health_history", { p_limit: RUNS_SHOWN }, { name: "admin_health" }),
  ]);
  const now = agora();
  const history = hist.state === "ok" ? (hist.degraded ? historyFromLegacy(hist.data) : toHistory(hist.data)) : null;
  const views = history ? history.jobs.map((j) => jobView(j, now)) : [];
  const streakAlerts = views.filter((v) => v.alert);
  const csv = views.map((v) => ({ name: v.name, schedule: v.schedule, readable: v.readable, active: v.active ? "sim" : "não", last: v.last ? when(v.last.startedAt) : "", status: v.last?.status ?? "", duration: duration(v.last?.durationMs), next: v.next ? when(v.next.toISOString()) : "", streak: v.streak }));
  return (
    <>
      <PageHead titulo="Saúde operacional" texto="Rotinas agendadas, filas e atrasos medidos no banco."
        acao={<CsvButton filename="rotinas" rows={csv} cols={[{ key: "name", label: "Rotina" }, { key: "schedule", label: "Cron" }, { key: "readable", label: "Agenda" }, { key: "active", label: "Ativa" }, { key: "last", label: "Última execução" }, { key: "status", label: "Resultado" }, { key: "duration", label: "Duração" }, { key: "next", label: "Próxima" }, { key: "streak", label: "Falhas seguidas" }]} />} />
      {hist.state === "ok" && hist.degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco.</p>}
      {(streakAlerts.length > 0 || (r.state === "ok" && healthAlerts(r.data).length > 0)) && (
        <ul className={css.alerts} aria-label="Alertas de saúde">
          {streakAlerts.map((v) => <li key={`s-${v.name}`} data-testid="alerta-saude"><Pill tone="crit">Crítico</Pill><strong>{v.name}</strong><span>{num(v.streak)} falhas seguidas (alerta a partir de {FAIL_STREAK_ALERT}).</span></li>)}
          {r.state === "ok" && healthAlerts(r.data).filter((a) => !streakAlerts.some((v) => a.id === `job-${v.name}`)).map((a) => <li key={a.id} data-testid="alerta-saude"><Pill tone="warn">Atenção</Pill><span>{a.text}</span></li>)}
        </ul>
      )}
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <div className={`adm-grid ${css.cards}`}>
          <Metric rotulo="Revelações atrasadas" valor={num(r.data.reveals.overdue)} nota={r.data.reveals.overdue ? `maior atraso ${Math.round(r.data.reveals.maxDelaySeconds / 60)} min` : undefined} />
          <Metric rotulo="Fila de limpeza" valor={num(r.data.purgeQueue.size)} />
          <Metric rotulo="Uploads parados (>1 h)" valor={num(r.data.uploads.stalled)} />
          <Metric rotulo="Exclusões LGPD pendentes" valor={num(r.data.lgpd.pendingDeletions)} />
        </div>
      )}
      {hist.state !== "ok" ? <StateBox load={hist} /> : !history?.cronAvailable ? (
        <div className="adm-state" role="alert">pg_cron indisponível: as rotinas agendadas não estão rodando.</div>
      ) : views.length === 0 ? (
        <EmptyState title="Nenhuma rotina mm-* registrada" text="As rotinas são criadas pelas migrations; confira se foram aplicadas." />
      ) : (
        <ul className={css.jobs} aria-label="Rotinas">{views.map((v) => <Job key={v.name} v={v} />)}</ul>
      )}
    </>
  );
}
