import { Fragment } from "react";
import Link from "next/link";
import { requireMaster, rpc, rpcOr, when, type SearchParams } from "../data";
import { num } from "@/features/master/format";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Pill } from "../kit/Pill";
import { hrefWith } from "../kit/url";
import { withShellParams } from "../shell/params";
import { PageHead, StateBox } from "../ui";
import { CATEGORIES, categoryOf, dayLabel, groupByDay, isSensitive, legacyIsPartial, roleLabel, targetEvent, targetText, type AuditItem } from "./lib";
import styles from "./page.module.css";

const PATH = "/master/auditoria";
const POR = 50;
type List = { total: number; items: AuditItem[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Auditoria({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const p = Math.max(1, Number(first(sp.p)) || 1);
  const a = first(sp.a)?.slice(0, 60) || null;
  const cat = a ? null : categoryOf(sp.cat);
  const page = { p_limit: POR, p_offset: (p - 1) * POR };

  // Prefixo livre usa a RPC antiga (sempre existe); categorias usam a nova, com o prefixo principal como reserva.
  const r = a
    ? await rpc<List>(sb, "admin_list_audit", { ...page, p_action: a })
    : await rpcOr<List>(sb, "admin_list_audit_v2", { ...page, p_category: cat }, { name: "admin_list_audit", args: { ...page, p_action: cat ? CATEGORIES.find((c) => c.key === cat)!.legacy : null } });
  const degraded = r.state === "ok" && !!r.degraded;
  const items = r.state === "ok" ? r.data.items.map((x) => ({ ...x, sensitive: x.sensitive ?? isSensitive(x.action, x.reason) })) : [];
  const groups = groupByDay(items);
  const pages = r.state === "ok" ? Math.max(1, Math.ceil(r.data.total / POR)) : 1;
  const sensitiveCount = items.filter((x) => x.sensitive).length;

  return (
    <>
      <PageHead titulo="Auditoria e segurança" texto="Registro imutável de ações administrativas e de segurança. Ações sensíveis exigem justificativa e aparecem destacadas." />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco.{cat && legacyIsPartial(cat) ? ` Até lá, esta categoria filtra só ações que começam com "${CATEGORIES.find((c) => c.key === cat)!.legacy}".` : ""}</p>}

      <nav className={styles.chips} aria-label="Categoria">
        <Link className="adm-btn" href={hrefWith(PATH, sp, { cat: null, a: null })} aria-current={!cat && !a ? "page" : undefined}>Todas</Link>
        {CATEGORIES.map((c) => <Link key={c.key} className="adm-btn" href={hrefWith(PATH, sp, { cat: c.key, a: null })} aria-current={cat === c.key ? "page" : undefined}>{c.label}</Link>)}
      </nav>
      <form method="get" role="search" className={styles.search}>
        <label htmlFor="a" className="adm-sr">Prefixo da ação</label>
        <input id="a" name="a" className="mm-field-input" placeholder="Ação começa com (ex.: photo.)" defaultValue={a ?? ""} />
        <button className="adm-btn" type="submit">Filtrar</button>
        {a && <Link className="adm-btn" href={hrefWith(PATH, sp, { a: null })}>Limpar</Link>}
      </form>

      {r.state !== "ok" ? <StateBox load={r} /> : items.length === 0 ? (
        <EmptyState title="Nenhum registro" text={cat || a ? "Nada com este filtro. Tente outra categoria." : "Ainda não há ações registradas."}
          action={cat || a ? { href: hrefWith(PATH, sp, { cat: null, a: null }), label: "Ver todas" } : undefined} />
      ) : (
        <>
          <div className={styles.summary}>
            <p>{num(r.data.total)} registros · página {p} de {pages}{sensitiveCount > 0 && <> · <Pill tone="warn">{num(sensitiveCount)} sensíveis nesta página</Pill></>}</p>
            <CsvButton filename={`auditoria-p${p}`} label="Exportar página (CSV)"
              rows={items.map((x) => ({ quando: x.at, acao: x.action, papel: roleLabel(x.actorRole), alvo: targetText(x), evento: targetEvent(x) ?? "", justificativa: x.reason ?? "", sensivel: x.sensitive ? "sim" : "não" }))}
              cols={[{ key: "quando", label: "Quando" }, { key: "acao", label: "Ação" }, { key: "papel", label: "Papel" }, { key: "alvo", label: "Alvo" }, { key: "evento", label: "Evento" }, { key: "justificativa", label: "Justificativa" }, { key: "sensivel", label: "Sensível" }]} />
          </div>
          <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Registros de auditoria">
            <table className="adm-table">
              <thead><tr><th scope="col">Hora</th><th scope="col">Ação</th><th scope="col">Papel</th><th scope="col">Alvo</th><th scope="col">Justificativa</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.day}>
                    <tr className={styles.dayRow}><th scope="rowgroup" colSpan={5}>{dayLabel(g.day)} <span>{num(g.items.length)}</span></th></tr>
                    {g.items.map((x) => {
                      const ev = targetEvent(x);
                      return (
                        <tr key={x.id} className={x.sensitive ? styles.sensitive : undefined}>
                          <td className="num">{when(x.at).split(" ").pop()}</td>
                          <td><span className={styles.action}><code>{x.action}</code>{x.sensitive && <Pill tone="warn">sensível</Pill>}</span></td>
                          <td>{roleLabel(x.actorRole)}</td>
                          <td>{ev ? <Link href={withShellParams(`/master/eventos?ev=${ev}`, sp)}>{targetText(x)}</Link> : targetText(x)}</td>
                          <td>{x.reason ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Paginação" className={styles.pager}>
            {p > 1 && <Link className="adm-btn" href={hrefWith(PATH, sp, { p: String(p - 1) })}>Anterior</Link>}
            <span>Página {p} de {pages}</span>
            {p < pages && <Link className="adm-btn" href={hrefWith(PATH, sp, { p: String(p + 1) })}>Próxima</Link>}
          </nav>
        </>
      )}
    </>
  );
}
