import Link from "next/link";
import { countdown, num } from "@/features/master/format";
import { includeTests, requireMaster, rpc, rpcOr, type SearchParams } from "../data";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { TestToggle } from "../kit/TestToggle";
import { hrefWith } from "../kit/url";
import { withShellParams } from "../shell/params";
import { PageHead, StateBox } from "../ui";
import { toEventPage, when } from "../eventos/lib";
import { byDay, revealCounts, revealTimeline, type RevealItem } from "./lib";
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
  // Filtrado no banco (só revelações não executadas) e em ordem crescente: atrasadas primeiro, depois a mais próxima.
  // As contagens vêm dos totais do banco; a de atrasadas, de uma segunda consulta só com elas.
  const base = { p_offset: 0, p_search: null, p_status: null, p_include_tests: includeTests(sp), p_sort: "revealAt", p_dir: "asc" };
  const [r, late] = await Promise.all([
    rpcOr<unknown>(sb, "admin_list_events_v2", { ...base, p_limit: 100, p_reveal: "pendente" },
      { name: "admin_list_events", args: { p_limit: 100, p_offset: 0 } }),
    rpc<unknown>(sb, "admin_list_events_v2", { ...base, p_limit: 1, p_reveal: "atrasada" }),
  ]);
  const now = agora();
  const page = r.state === "ok" ? toEventPage(r.data) : { total: 0, items: [] };
  const t = r.state === "ok" ? revealTimeline(page.items, now) : { overdue: [], upcoming: [] };
  const degraded = r.state === "ok" && !!r.degraded;
  const c = revealCounts(t, { degraded, pendingTotal: page.total, overdueTotal: late.state === "ok" ? toEventPage(late.data).total : undefined });
  const csv = [...t.overdue, ...t.upcoming].map((x) => ({ id: x.row.id, title: x.row.title, host: x.row.hostName, at: when(x.row.revealAt), state: x.overdue ? "atrasada" : "pendente", teste: x.row.isTest ? "sim" : "" }));
  return (
    <>
      <PageHead titulo="Revelações" texto="Revelações ainda não executadas pelo servidor. Atrasadas primeiro."
        acao={<div className={css.headActions}><TestToggle path={PATH} params={sp} />
          <CsvButton filename="revelacoes" rows={csv} cols={[{ key: "id", label: "ID" }, { key: "title", label: "Evento" }, { key: "host", label: "Anfitrião" }, { key: "at", label: "Revela em" }, { key: "state", label: "Estado" }, { key: "teste", label: "Teste" }]} /></div>} />
      {degraded && (
        <p className="adm-aviso-degradado">
          Lista parcial: sem a atualização do banco não dá para contar as atrasadas e as programadas. Dados completos após a atualização do banco.
        </p>
      )}
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          {c.overdue !== null && c.upcoming !== null && (
            <div className={css.summary} aria-label="Resumo">
              <Pill tone={c.overdue ? "crit" : "ok"}>{num(c.overdue)} atrasadas</Pill>
              <Pill tone={c.upcoming ? "warn" : "dim"}>{num(c.upcoming)} programadas</Pill>
              {c.partial && <span>Mostrando as {num(c.shown)} primeiras.</span>}
            </div>
          )}
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
            )) : degraded ? null : (
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
