import { listArgs, type ListProps } from "../pagination";
import { requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table, ListSearchForm, ListPagination } from "../ui";

interface Ev { id: string; title: string; hostName: string; revealAt: string | null; revealState: string }
export default async function Revelacoes({ searchParams }: ListProps) {
  const sp = await searchParams;
  const sb = await requireMaster();
  const r = await rpc<{ total: number; items: Ev[] }>(sb, "admin_list_reveals", listArgs(sp));

  return (
    <>
      <PageHead titulo="Revelações" texto="Eventos com revelação ainda não executada pelo servidor; atrasadas primeiro quando passam do horário." />
      <ListSearchForm q={sp.q} />
      {r.state !== "ok" ? <StateBox load={r} /> : <><ListPagination total={r.data.total} sp={sp} /><Table vazio="Nenhuma revelação pendente." cols={[{ k: "t", h: "Evento" }, { k: "h", h: "Anfitrião" }, { k: "a", h: "Revela em" }, { k: "s", h: "Estado" }]}
        rows={r.data.items.map((e) => ({ t: e.title, h: e.hostName, a: when(e.revealAt), s: <Badge s={e.revealState === "atrasada" ? "erro" : "aviso"}>{e.revealState}</Badge> }))} /></>}
    </>
  );
}
