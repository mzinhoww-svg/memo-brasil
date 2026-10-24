import Link from "next/link";
import { includeTests, num, requireMaster, rpcOr, when } from "../data";
import type { SearchParams } from "../data";
import { PageHead, StateBox } from "../ui";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { StackBar } from "../kit/StackBar";
import { TestToggle } from "../kit/TestToggle";
import { hrefWith } from "../kit/url";
import { Pager } from "./Pager";
import { fromLegacy, kindOf, LEGACY_LIMIT, pageCount, parseKind, parsePage, parseQuery, PER_PAGE, type UserItem, type UsersPage } from "./lib";
import s from "./page.module.css";

const PATH = "/master/usuarios";
const KIND_LABEL = { google: "Google", email: "E-mail", anon: "Anônimo" } as const;

export default async function Usuarios({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const kind = parseKind(sp), page = parsePage(sp), q = parseQuery(sp), tests = includeTests(sp);
  const r = await rpcOr<UsersPage>(sb, "admin_list_users_v2",
    { p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE, p_kind: kind, p_include_tests: tests, p_search: q || null },
    { name: "admin_list_users", args: { p_limit: LEGACY_LIMIT, p_offset: 0 }, map: (d) => fromLegacy(d, { kind, q }, page) });

  return (
    <>
      <PageHead titulo="Usuários" texto="Contas de autenticação: Google, e-mail e convidados anônimos. Sem telefone nem metadados; e-mail completo só para master." acao={<TestToggle path={PATH} params={sp} />} />
      {r.state !== "ok" ? <StateBox load={r} /> : <Body r={r.data} degraded={!!r.degraded} sp={sp} kind={kind} page={page} q={q} />}
    </>
  );
}

function Body({ r, degraded, sp, kind, page, q }: { r: UsersPage; degraded: boolean; sp: SearchParams; kind: ReturnType<typeof parseKind>; page: number; q: string }) {
  const sm = r.summary;
  const items = r.items;
  const csvRows = items.map((u) => ({
    id: u.userId, tipo: KIND_LABEL[kindOf(u)], email: u.email ?? "", eventos: degraded ? "" : String(u.eventsLinked ?? 0),
    criado: u.createdAt, ultimo: u.lastSignInAt ?? "", papel: u.platformRole ?? "", situacao: u.orphanAnon ? "orfa" : u.isTest ? "teste" : "",
  }));
  const csvCols = [
    { key: "id", label: "ID" }, { key: "tipo", label: "Tipo" }, { key: "email", label: "E-mail" }, { key: "eventos", label: "Eventos vinculados" },
    { key: "criado", label: "Criado em" }, { key: "ultimo", label: "Último acesso" }, { key: "papel", label: "Papel" }, { key: "situacao", label: "Situação" },
  ] as const;
  const clean = { ...sp, q: undefined };
  return (
    <>
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco. Por ora: últimas {LEGACY_LIMIT} contas, sem eventos vinculados, órfãs nem filtro de testes.</p>}
      <section className="adm-card" aria-label="Resumo por tipo">
        <h2>Contas por tipo{degraded ? " (últimas carregadas)" : ""}</h2>
        <StackBar segments={[{ label: "Google", value: sm.google }, { label: "E-mail", value: sm.email }, { label: "Anônimo", value: sm.anon }]} />
        {sm.orphanAnon != null && <p className={`adm-nota ${s.note}`}>{num(sm.orphanAnon)} anônimas sem participação (órfãs), candidatas à limpeza automática.</p>}
      </section>

      <div className={s.tools}>
        <nav className="adm-tabs" aria-label="Tipo de conta">
          <Link className="adm-btn" href={hrefWith(PATH, sp, { tipo: null })} aria-current={!kind ? "page" : undefined}>Todos</Link>
          {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
            <Link key={k} className="adm-btn" href={hrefWith(PATH, sp, { tipo: k })} aria-current={kind === k ? "page" : undefined}>{KIND_LABEL[k]}</Link>
          ))}
        </nav>
        <CsvButton filename="usuarios" rows={csvRows} cols={csvCols} />
      </div>

      <form method="get" action={PATH} role="search" className={s.search}>
        {Object.entries(clean).map(([k, v]) => (typeof v === "string" && v && k !== "p" ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label className="adm-sr" htmlFor="q">Buscar por e-mail ou ID</label>
        <input id="q" name="q" className="mm-field-input" placeholder="E-mail ou ID da conta" defaultValue={q} maxLength={80} />
        <button className="adm-btn" type="submit">Buscar</button>
        {q && <Link className="adm-btn" href={hrefWith(PATH, sp, { q: null })}>Limpar</Link>}
      </form>

      {items.length === 0 ? (
        <EmptyState title="Nenhuma conta encontrada" text={q || kind ? "Nenhuma conta combina com os filtros atuais." : "Ainda não há contas."} action={q || kind ? { href: hrefWith(PATH, sp, { q: null, tipo: null }), label: "Limpar filtros" } : undefined} />
      ) : (
        <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Usuários">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">ID</th><th scope="col">Tipo</th><th scope="col">E-mail</th>
                {!degraded && <th scope="col" className="num">Eventos vinculados</th>}
                <th scope="col">Criado em</th><th scope="col">Último acesso</th><th scope="col">Papel</th>
                {!degraded && <th scope="col">Situação</th>}
              </tr>
            </thead>
            <tbody>{items.map((u) => <Row key={u.userId} u={u} degraded={degraded} />)}</tbody>
          </table>
        </div>
      )}
      <Pager path={PATH} params={sp} page={page} pages={pageCount(r.total)} total={num(r.total)} noun="usuários" />
    </>
  );
}

function Row({ u, degraded }: { u: UserItem; degraded: boolean }) {
  const k = kindOf(u);
  return (
    <tr className={u.orphanAnon ? s.orphan : undefined}>
      <td><code className={s.id} title={u.userId}>{u.userId.slice(0, 8)}…</code></td>
      <td><Pill tone={k === "anon" ? "info" : "ok"}>{KIND_LABEL[k]}</Pill></td>
      <td>{u.email ?? "—"}</td>
      {!degraded && <td className="num">{num(u.eventsLinked ?? 0)}</td>}
      <td>{when(u.createdAt)}</td>
      <td>{when(u.lastSignInAt)}</td>
      <td>{u.platformRole ? <Pill tone="warn">{u.platformRole}</Pill> : "—"}</td>
      {!degraded && <td>{u.orphanAnon ? <Pill tone="warn">órfã</Pill> : u.isTest ? <Pill tone="dim">teste</Pill> : "—"}</td>}
    </tr>
  );
}
