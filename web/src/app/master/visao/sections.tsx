import Link from "next/link";
import { brl, bytes, countdown, num } from "@/features/master/format";
import type { SearchParams } from "@/features/master/params";
import { BarLineChart } from "../kit/BarLineChart";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Funnel } from "../kit/Funnel";
import { Kpi } from "../kit/Kpi";
import { Pill } from "../kit/Pill";
import { StackBar } from "../kit/StackBar";
import { withShellParams } from "../shell/params";
import { when } from "../eventos/lib";
import { chartData, readinessItems, type AttentionRow, type KpiData, type Overview } from "./lib";
import css from "./page.module.css";

const evHref = (id: string, sp: SearchParams) => withShellParams(`/master/eventos?ev=${id}`, sp);

export function Kpis({ o }: { o: Overview }) {
  const k = o.kpis;
  const one = (label: string, d: KpiData, fmt: (n: number) => string = num) =>
    <Kpi label={label} value={d.value == null ? "—" : fmt(d.value)} current={d.value ?? undefined} previous={d.previous} spark={d.spark.length > 1 ? d.spark : undefined} />;
  return (
    <div className={css.kpis}>
      {one("Eventos ativos", k.activeEvents)}
      {one("Participantes", k.participants)}
      {one("Fotos enviadas", k.photos)}
      {k.revenueCents.value == null
        ? <Kpi label={`Receita ${o.days} dias`} value="Só master" note="Dados de pagamento aparecem só para o papel master." />
        : one(`Receita ${o.days} dias`, k.revenueCents, (c) => brl(c))}
    </div>
  );
}

export function Activity({ o }: { o: Overview }) {
  return (
    <div className={css.chartWrap}>
      <BarLineChart title={`Atividade por dia, últimos ${o.days} dias`} data={chartData(o.series)} names={{ a: "Fotos", b: "Entradas", line: "Eventos criados" }} />
    </div>
  );
}

export function EventFunnel({ f }: { f: NonNullable<Overview["funnel"]> }) {
  return (
    <section className={css.card} aria-labelledby="vg-funil">
      <h2 id="vg-funil">Funil dos eventos criados no período</h2>
      {f.created === 0 ? <EmptyState title="Nenhum evento criado no período" /> : (
        <Funnel steps={[{ label: "Criados", value: f.created }, { label: "Com participante", value: f.withParticipant }, { label: "Com foto", value: f.withPhoto }, { label: "Revelados", value: f.revealed }]} />
      )}
    </section>
  );
}

export function UpcomingReveals({ items, now, sp }: { items: Overview["upcomingReveals"]; now: number; sp: SearchParams }) {
  return (
    <section className={css.card} aria-labelledby="vg-rev">
      <div className={css.cardHead}><h2 id="vg-rev">Próximas revelações</h2><Link href={withShellParams("/master/revelacoes", sp)}>Ver todas</Link></div>
      {items.length === 0 ? <EmptyState title="Nenhuma revelação pendente" /> : (
        <ul className={css.reveals}>
          {items.map((r) => {
            const late = Date.parse(r.revealAt) <= now;
            return (
              <li key={r.eventId}>
                <span><Link href={evHref(r.eventId, sp)}>{r.title || "Sem título"}</Link>{r.isTest && <> <Pill tone="info">TESTE</Pill></>}</span>
                <span className={css.when}><Pill tone={late ? "crit" : "warn"}>{late ? `atrasada ${countdown(r.revealAt, now)}` : countdown(r.revealAt, now)}</Pill><span className={css.muted}>{when(r.revealAt)}</span></span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Routines({ jobs, sp }: { jobs: Overview["jobs"]; sp: SearchParams }) {
  const fails = jobs.filter((j) => !j.ok).length;
  return (
    <section className={css.card} aria-labelledby="vg-rot">
      <div className={css.cardHead}>
        <h2 id="vg-rot">Rotinas</h2>
        <Pill tone={fails ? "crit" : "ok"}>{fails ? `${num(fails)} com falha` : `ok ${num(jobs.length)}/${num(jobs.length)}`}</Pill>
      </div>
      {jobs.length === 0 ? <EmptyState title="Nenhuma rotina registrada" /> : (
        <ul className={css.jobs}>
          {jobs.map((j) => <li key={j.name}><span className={css.sq} data-tone={j.ok ? "ok" : "crit"} aria-hidden="true" /><span>{j.name}<span className="adm-sr">: {j.ok ? "ok" : "falhou"}</span></span></li>)}
        </ul>
      )}
      <Link href={withShellParams("/master/saude", sp)} className={css.muted}>Ver histórico em Saúde</Link>
    </section>
  );
}

export function Storage({ s, sp }: { s: NonNullable<Overview["storage"]>; sp: SearchParams }) {
  return (
    <section className={css.card} aria-labelledby="vg-sto">
      <div className={css.cardHead}><h2 id="vg-sto">Storage de fotos · {bytes(s.bytes)}</h2><Link href={withShellParams("/master/storage", sp)}>Detalhes</Link></div>
      <StackBar label={`Arquivos: ${num(s.originals)} originais, ${num(s.derived)} derivados, ${num(s.orphans)} órfãos`}
        segments={[{ label: "Originais", value: s.originals }, { label: "Derivados", value: s.derived }, { label: "Órfãos", value: s.orphans, color: "var(--crit)" }]} />
      {s.orphans > 0 && <span className={css.muted}>Órfão = arquivo sem foto correspondente no banco.</span>}
    </section>
  );
}

export function Readiness({ r, sp }: { r: Overview["readiness"]; sp: SearchParams }) {
  const items = readinessItems(r);
  if (!items.length || items.every((i) => i.ok)) return null;
  const missing = items.filter((i) => !i.ok).length;
  return (
    <section className={css.card} aria-labelledby="vg-pronto">
      <div className={css.cardHead}><h2 id="vg-pronto">Pronto para produção</h2><Pill tone="warn">faltam {num(missing)}</Pill></div>
      <ul className={css.ready}>
        {items.map((i) => <li key={i.key}><span>{i.label}</span><Pill tone={i.ok ? "ok" : "warn"}>{i.ok ? "ok" : "pendente"}</Pill></li>)}
      </ul>
      <Link href={withShellParams("/master/configuracoes", sp)} className="adm-btn">Abrir configurações</Link>
    </section>
  );
}

export function Attention({ rows, sp, testsHidden }: { rows: AttentionRow[]; sp: SearchParams; testsHidden: boolean }) {
  const csv = rows.map(({ row, risk }) => ({ id: row.id, title: row.title, host: row.hostName, score: risk.score, signals: risk.signals.map((s) => s.label).join(", ") }));
  return (
    <section className={css.section} aria-labelledby="vg-aten">
      <div className={css.cardHead}>
        <h2 id="vg-aten">Eventos que pedem atenção</h2>
        <CsvButton filename="eventos-atencao" rows={csv} cols={[{ key: "id", label: "ID" }, { key: "title", label: "Evento" }, { key: "host", label: "Anfitrião" }, { key: "score", label: "Risco" }, { key: "signals", label: "Sinais" }]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nenhum evento com sinal de risco" text={testsHidden ? "Entre os eventos recentes, sem contar testes." : "Entre os eventos recentes."} />
      ) : (
        <div className={`adm-table-wrap ${css.table}`} role="region" tabIndex={0} aria-label="Eventos que pedem atenção">
          <table className="adm-table">
            <thead><tr><th scope="col">Evento</th><th scope="col">Sinais</th><th scope="col" className="num">Risco</th><th scope="col">Início</th></tr></thead>
            <tbody>
              {rows.map(({ row, risk }) => (
                <tr key={row.id}>
                  <td><Link href={evHref(row.id, sp)}>{row.title || "Sem título"}</Link>{row.isTest && <> <Pill tone="info">TESTE</Pill></>}<div className={css.muted}>{row.hostName || "sem anfitrião"}</div></td>
                  <td><span className={css.signals}>{risk.signals.map((s) => <Pill key={s.code} tone={s.severity}>{s.label}</Pill>)}</span></td>
                  <td className="num">{num(risk.score)}</td>
                  <td className={css.muted}>{when(row.startAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
