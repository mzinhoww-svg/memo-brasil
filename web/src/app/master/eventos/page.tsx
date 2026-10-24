import Link from "next/link";
import { num } from "@/features/master/format";
import { planLabel } from "@/features/master/plan";
import { includeTests, requireMaster, rpc, rpcOr, type SearchParams } from "../data";
import { CsvButton } from "../kit/CsvButton";
import { Drawer } from "../kit/Drawer";
import { EmptyState } from "../kit/EmptyState";
import { TestToggle } from "../kit/TestToggle";
import { hrefWith, parseSort, sortRows } from "../kit/url";
import { PageHead, StateBox } from "../ui";
import { EventDrawerBody } from "./EventDrawerBody";
import { EventsTable, type TableRow } from "./EventsTable";
import { detailFromList, eventParam, PAGE_SIZE, pageParam, searchParam, SORT_KEYS, statusParam, toCatalog, toEventDetail, toEventPage, when } from "./lib";
import css from "./page.module.css";

const PATH = "/master/eventos";
const CSV_COLS = [
  { key: "id", label: "ID" }, { key: "title", label: "Evento" }, { key: "hostName", label: "Anfitrião" }, { key: "status", label: "Situação" },
  { key: "plan", label: "Plano" }, { key: "participants", label: "Convidados" }, { key: "capacity", label: "Limite" }, { key: "photos", label: "Fotos" },
  { key: "failedUploads", label: "Falhas" }, { key: "revealState", label: "Revelação" }, { key: "revealAtTxt", label: "Revela em" }, { key: "startAtTxt", label: "Início" }, { key: "teste", label: "Teste" },
] as const;

export default async function Eventos({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const status = statusParam(sp);
  const q = searchParam(sp);
  const p = pageParam(sp);
  const ev = eventParam(sp);
  const { ord, dir } = parseSort(sp, SORT_KEYS, { ord: "createdAt", dir: "desc" });
  const offset = (p - 1) * PAGE_SIZE;

  const [list, plans, detail] = await Promise.all([
    rpcOr<unknown>(sb, "admin_list_events_v2",
      { p_limit: PAGE_SIZE, p_offset: offset, p_search: q, p_status: status, p_include_tests: includeTests(sp), p_sort: ord, p_dir: dir },
      { name: "admin_list_events", args: { p_limit: PAGE_SIZE, p_offset: offset, p_search: q, p_status: status === "excluido" ? null : status } }),
    rpc<unknown>(sb, "admin_list_plans"),
    ev ? rpcOr<unknown>(sb, "admin_event_detail", { p_event: ev }, { name: "admin_list_events", args: { p_limit: 100, p_offset: 0 } }) : Promise.resolve(null),
  ]);
  const catalog = plans.state === "ok" ? toCatalog(plans.data) : [];
  const degraded = list.state === "ok" && !!list.degraded;
  const page = list.state === "ok" ? toEventPage(list.data) : { total: 0, items: [] };
  // Sem a RPC nova a ordenação vale só para a página atual.
  const items = degraded ? sortRows(page.items, ord, dir) : page.items;
  const rows: TableRow[] = items.map((e) => ({ ...e, plan: planLabel(e.capacity, e.planCode, catalog) }));
  const csv = rows.map((r) => ({ ...r, revealAtTxt: when(r.revealAt), startAtTxt: when(r.startAt), teste: r.isTest == null ? "" : r.isTest ? "sim" : "não" }));
  const pages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const filtered = !!(q || status);

  const drawer = detail && detail.state === "ok"
    ? (detail.degraded ? detailFromList(detail.data, ev as string) : toEventDetail(detail.data))
    : null;
  const closeHref = hrefWith(PATH, sp, { ev: null, p: p > 1 ? String(p) : null });

  return (
    <>
      <PageHead titulo="Eventos" texto="Metadados, plano e ocupação. Fotos privadas não aparecem aqui."
        acao={<div className={css.headActions}><TestToggle path={PATH} params={sp} /><CsvButton filename="eventos" rows={csv} cols={CSV_COLS} /></div>} />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco.</p>}
      <div className={css.toolbar}>
        <form method="get" action={PATH} className={css.search} role="search">
          {includeTests(sp) && <input type="hidden" name="testes" value="1" />}
          {ord !== "createdAt" && <input type="hidden" name="ord" value={ord} />}
          {dir !== "desc" && <input type="hidden" name="dir" value={dir} />}
          <label className="adm-sr" htmlFor="ev-q">Buscar</label>
          <input id="ev-q" name="q" className="mm-field-input" placeholder="Nome do evento ou do anfitrião" defaultValue={q ?? ""} />
          <label className="adm-sr" htmlFor="ev-status">Situação</label>
          <select id="ev-status" name="status" className="mm-field-input" defaultValue={status ?? ""}>
            <option value="">Todas as situações</option>
            <option value="ativo">Ativos</option>
            <option value="encerrado">Encerrados</option>
            {!degraded && <option value="excluido">Excluídos</option>}
          </select>
          <button className="adm-btn" type="submit">Filtrar</button>
          {filtered && <Link className="adm-btn" href={hrefWith(PATH, sp, { q: null, status: null })}>Limpar</Link>}
        </form>
      </div>
      {list.state !== "ok" ? <StateBox load={list} /> : rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum evento com esses filtros" : "Nenhum evento ainda"}
          text={filtered ? "Mude a busca ou a situação." : includeTests(sp) ? "Ainda não há eventos criados." : "Eventos de teste estão ocultos; mostre-os para ver todos."}
          action={filtered ? { href: hrefWith(PATH, sp, { q: null, status: null }), label: "Limpar filtros" } : !includeTests(sp) ? { href: hrefWith(PATH, sp, { testes: "1" }), label: "Mostrar testes" } : undefined} />
      ) : (
        <>
          <EventsTable rows={rows} path={PATH} params={sp} ord={ord} dir={dir} bulk={!degraded} />
          <nav aria-label="Paginação" className={css.pager}>
            {p > 1 && <Link className="adm-btn" href={hrefWith(PATH, sp, { p: String(p - 1) })}>Anterior</Link>}
            <span>Página {num(p)} de {num(pages)} · {num(page.total)} eventos</span>
            {p < pages && <Link className="adm-btn" href={hrefWith(PATH, sp, { p: String(p + 1) })}>Próxima</Link>}
          </nav>
        </>
      )}
      {ev && (
        <Drawer title={drawer?.event.title || "Evento"} closeHref={closeHref}>
          {detail && detail.state !== "ok" && !(detail.state === "error" && /invalid/i.test(detail.message)) ? <StateBox load={detail} /> : drawer
            ? <EventDrawerBody d={drawer} catalog={catalog} degraded={!!(detail && detail.state === "ok" && detail.degraded)} />
            : <EmptyState title="Evento não encontrado" text="Ele pode ter sido excluído ou estar fora da lista recente." action={{ href: closeHref, label: "Voltar à lista" }} />}
        </Drawer>
      )}
    </>
  );
}
