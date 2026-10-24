import { includeTests, num, requireMaster, rpc, when } from "../data";
import type { SearchParams } from "../data";
import { PageHead, StateBox } from "../ui";
import { pct } from "@/features/master/format";
import { CsvButton } from "../kit/CsvButton";
import { EmptyState } from "../kit/EmptyState";
import { Kpi } from "../kit/Kpi";
import { Pill } from "../kit/Pill";
import { TestToggle } from "../kit/TestToggle";
import { loadEvents } from "../organizadores/events";
import { collectPages } from "../organizadores/lib";
import { excludeTestEvents, groupByEvent, inviteStats, visibleColumns, type Invite, type Part } from "./lib";
import s from "./page.module.css";

const PATH = "/master/participantes";
const PAGE = 200, CAP = 1000;

async function all<T>(sb: Awaited<ReturnType<typeof requireMaster>>, name: string) {
  return collectPages<T>(async (offset) => {
    const r = await rpc<{ total: number; items: T[] }>(sb, name, { p_limit: PAGE, p_offset: offset });
    return r.state === "ok" ? { ok: true, total: r.data.total, items: r.data.items } : { ok: false };
  }, PAGE, CAP);
}

export default async function Participantes({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const tests = includeTests(sp);
  const [pRaw, iRaw, ev] = await Promise.all([all<Part>(sb, "admin_list_participants"), all<Invite>(sb, "admin_list_invites"), tests ? Promise.resolve(null) : loadEvents(sb, true)]);

  // Eventos de teste só são conhecidos com a RPC nova; antes dela nada é filtrado.
  const testIds = ev && !ev.degraded ? new Set(ev.events.filter((e) => e.isTest).map((e) => e.id)) : null;
  const degraded = !tests && !testIds;
  const parts = excludeTestEvents(pRaw.items, testIds);
  const invites = excludeTestEvents(iRaw.items, testIds);
  const groups = groupByEvent(parts);
  const st = inviteStats(invites);
  const cols = visibleColumns(parts, ["table"]);
  const showTable = cols.includes("table");
  const inviteCols = visibleColumns(invites, ["expiresAt"]);
  const showExpires = inviteCols.includes("expiresAt");

  const pCsv = parts.map((x) => ({ evento: x.eventTitle, nome: x.name, mesa: x.table ?? "", entrou: x.joinedAt, situacao: x.blocked ? "bloqueado" : x.isHost ? "organizador" : "ativo" }));
  const pCsvCols = [{ key: "evento", label: "Evento" }, { key: "nome", label: "Nome" }, ...(showTable ? [{ key: "mesa", label: "Mesa" } as const] : []), { key: "entrou", label: "Entrou em" }, { key: "situacao", label: "Situação" }] as const;
  const iCsv = invites.map((x) => ({ evento: x.eventTitle, rotulo: x.label, usos: x.uses, max: x.maxUses ?? "", expira: x.expiresAt ?? "", estado: x.state }));
  const iCsvCols = [{ key: "evento", label: "Evento" }, { key: "rotulo", label: "Rótulo" }, { key: "usos", label: "Usos" }, { key: "max", label: "Máximo de usos" }, ...(showExpires ? [{ key: "expira", label: "Expira" } as const] : []), { key: "estado", label: "Estado" }] as const;

  return (
    <>
      <PageHead titulo="Convites e participantes" texto="Quem entrou em cada evento e o estado dos convites. Tokens de convite nunca aparecem." acao={<TestToggle path={PATH} params={sp} />} />
      {degraded && <p className="adm-aviso-degradado">Dados completos após a atualização do banco. Por ora: eventos de teste não são filtrados.</p>}

      <h2 className={s.sec}>Participantes <small>({num(parts.length)} em {num(groups.length)} eventos)</small></h2>
      {pRaw.failed ? <StateBox load={{ state: "error", message: "lista de participantes indisponível" }} /> : (
        <>
          {pRaw.truncated && <p className="adm-aviso-degradado">Mostrando os {num(pRaw.items.length)} mais recentes de {num(pRaw.total)}.</p>}
          <div className={s.tools}><CsvButton filename="participantes" rows={pCsv} cols={pCsvCols} /></div>
          {groups.length === 0 ? (
            <EmptyState title="Nenhum participante" text={tests ? "Ninguém entrou em um evento ainda." : "Nenhum participante em eventos reais. Mostre os testes para ver o restante."} action={tests ? undefined : { href: `${PATH}?testes=1`, label: "Mostrar testes" }} />
          ) : groups.map((g, i) => (
            <details key={g.key} className={s.group} open={i === 0}>
              <summary>
                <span>{g.title}</span>
                {g.blocked > 0 && <Pill tone="crit">{num(g.blocked)} bloqueado{g.blocked > 1 ? "s" : ""}</Pill>}
                <span className={`adm-nota ${s.cnt}`}>{num(g.count)} participante{g.count > 1 ? "s" : ""}</span>
              </summary>
              <div className="adm-table-wrap" role="region" tabIndex={0} aria-label={`Participantes de ${g.title}`}>
                <table className="adm-table">
                  <thead><tr><th scope="col">Nome</th>{showTable && <th scope="col">Mesa</th>}<th scope="col">Entrou em</th><th scope="col">Situação</th></tr></thead>
                  <tbody>{g.items.map((x, j) => (
                    <tr key={j}>
                      <td>{x.name}</td>{showTable && <td>{x.table ?? "—"}</td>}<td>{when(x.joinedAt)}</td>
                      <td>{x.blocked ? <Pill tone="crit">bloqueado</Pill> : x.isHost ? <Pill tone="info">organizador</Pill> : <Pill tone="ok">ativo</Pill>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          ))}
        </>
      )}

      <h2 className={s.sec}>Convites <small>({num(invites.length)})</small></h2>
      {iRaw.failed ? <StateBox load={{ state: "error", message: "lista de convites indisponível" }} /> : (
        <>
          {iRaw.truncated && <p className="adm-aviso-degradado">Mostrando os {num(iRaw.items.length)} mais recentes de {num(iRaw.total)}.</p>}
          {invites.length === 0 ? (
            <EmptyState title="Nenhum convite criado" text="Os convites aparecem quando um organizador gera um link de entrada para o evento. Sem convites, as pessoas entram pelo código do evento." action={tests ? undefined : { href: `${PATH}?testes=1`, label: "Mostrar testes" }} />
          ) : (
            <>
              <div className={s.kpis}>
                <Kpi label="Convites" value={num(st.total)} note={`${num(st.active)} ativos`} />
                <Kpi label="Convites usados" value={num(st.used)} />
                <Kpi label="Taxa convite para entrada" value={pct(st.used, st.total)} note="Convites com ao menos uma entrada" />
                <Kpi label="Entradas por convite" value={num(st.entries)} />
              </div>
              <div className={s.tools}><CsvButton filename="convites" rows={iCsv} cols={iCsvCols} /></div>
              <div className="adm-table-wrap" role="region" tabIndex={0} aria-label="Convites">
                <table className="adm-table">
                  <thead><tr><th scope="col">Evento</th><th scope="col">Rótulo</th><th scope="col" className="num">Usos</th>{showExpires && <th scope="col">Expira</th>}<th scope="col">Estado</th></tr></thead>
                  <tbody>{invites.map((x, j) => (
                    <tr key={x.id ?? j}>
                      <td>{x.eventTitle}</td><td>{x.label}</td><td className="num">{num(x.uses)}{x.maxUses ? ` / ${num(x.maxUses)}` : ""}</td>
                      {showExpires && <td>{when(x.expiresAt)}</td>}
                      <td><Pill tone={x.state === "ativo" ? "ok" : x.state === "revogado" ? "crit" : "warn"}>{x.state}</Pill></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
