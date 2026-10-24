import Link from "next/link";
import { countdown, num } from "@/features/master/format";
import { includeTests, requireMaster, rpcOr, type SearchParams } from "../data";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { TestToggle } from "../kit/TestToggle";
import { hrefWith } from "../kit/url";
import { withShellParams } from "../shell/params";
import { PageHead, StateBox } from "../ui";
import { toEventPage, when } from "../eventos/lib";
import { byDay, revealTimeline, type RevealItem } from "./lib";
import { RevealNowButton } from "./RevealNowButton";
import css from "./page.module.css";

const PATH = "/master/revelacoes";
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", hour: "2-digit", minute: "2-digit" });
const agora = () => Date.now();

function Item({ it, now, canAct, sp }: { it: RevealItem; now: number; canAct: boolean; sp: SearchParams }) {
  const r = it.row;
  return (
    <li className={css.item} data-overdue={it.overdue || undefined}>
      <span className={css.time}>{hora.format(it.at)}</span>
      <div className={css.main}>
        <Link href={withShellParams(`/master/eventos?ev=${r.id}`, sp)}>{r.title || "Sem título"}</Link>
        <span className={css.meta}>
          <Pill tone={it.overdue ? "crit" : "warn"}>{it.overdue ? `atrasada ${countdown(it.at, now)}` : countdown(it.at, now)}</Pill>
          {r.isTest && <Pill tone="info">TESTE</Pill>}
          <span>{r.hostName || "sem anfitrião"}</span>
          <span>{num(r.participants)} convidados · {num(r.photos)} fotos</span>
        </span>
      </div>
      <div className={css.actions}>{canAct && <RevealNowButton eventId={r.id} title={r.title} when={when(r.revealAt)} />}</div>
    </li>
  );
}

export default async function Revelacoes({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  // Ordenado por horário de revelação decrescente: as futuras e as atrasadas recentes cabem nas 100 primeiras.
  const r = await rpcOr<unknown>(sb, "admin_list_events_v2",
    { p_limit: 100, p_offset: 0, p_search: null, p_status: null, p_include_tests: includeTests(sp), p_sort: "revealAt", p_dir: "desc" },
    { name: "admin_list_events", args: { p_limit: 100, p_offset: 0 } });
  const now = agora();
  const t = r.state === "ok" ? revealTimeline(toEventPage(r.data).items, now) : { overdue: [], upcoming: [] };
  const degraded = r.state === "ok" && !!r.degraded;
  const csv = [...t.overdue, ...t.upcoming].map((x) => ({ id: x.row.id, title: x.row.title, host: x.row.hostName, at: when(x.row.revealAt), state: x.overdue ? "atrasada" : "pendente", teste: x.row.isTest ? "sim" : "" }));
  return (
    <>
      <PageHead titulo="Revelações" texto="Revelações ainda não executadas pelo servidor. Atrasadas primeiro."
        acao={<div className={css.headActions}><TestToggle path={PATH} params={sp} />
          <CsvButton filename="revelacoes" rows={csv} cols={[{ key: "id", label: "ID" }, { key: "title", label: "Evento" }, { key: "host", label: "Anfitrião" }, { key: "at", label: "Revela em" }, { key: "state", label: "Estado" }, { key: "teste", label: "Teste" }]} /></div>} />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco.</p>}
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <div className={css.summary} aria-label="Resumo">
            <Pill tone={t.overdue.length ? "crit" : "ok"}>{num(t.overdue.length)} atrasadas</Pill>
            <Pill tone={t.upcoming.length ? "warn" : "dim"}>{num(t.upcoming.length)} programadas</Pill>
          </div>
          {t.overdue.length > 0 && (
            <section className={css.group} aria-labelledby="rv-atrasadas">
              <h2 id="rv-atrasadas"><Pill tone="crit">Crítico</Pill> Atrasadas</h2>
              <ol className={css.list}>{t.overdue.map((it) => <Item key={it.row.id} it={it} now={now} canAct={!degraded} sp={sp} />)}</ol>
            </section>
          )}
          <section className={css.group} aria-labelledby="rv-proximas">
            <h2 id="rv-proximas">Próximas</h2>
            {t.upcoming.length ? byDay(t.upcoming).map((g) => (
              <div key={g.day}>
                <h3 className={css.day}>{g.day}</h3>
                <ol className={css.list}>{g.items.map((it) => <Item key={it.row.id} it={it} now={now} canAct={!degraded} sp={sp} />)}</ol>
              </div>
            )) : (
              <EmptyState title="Nenhuma revelação programada"
                text={includeTests(sp) ? "Nenhum evento tem revelação futura." : "Eventos de teste estão ocultos."}
                action={!includeTests(sp) ? { href: hrefWith(PATH, sp, { testes: "1" }), label: "Mostrar testes" } : undefined} />
            )}
          </section>
        </>
      )}
    </>
  );
}
