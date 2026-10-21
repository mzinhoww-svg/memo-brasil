import { requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table } from "../ui";

interface Ev { id: string; title: string; hostName: string; revealAt: string | null; revealState: string }
export default async function Revelacoes() {
  const sb = await requireMaster();
  const r = await rpc<{ items: Ev[] }>(sb, "admin_list_events", { p_limit: 100, p_offset: 0 });
  const abertas = r.state === "ok" ? r.data.items.filter((e) => e.revealState === "pendente" || e.revealState === "atrasada").sort((a, b) => String(a.revealAt).localeCompare(String(b.revealAt))) : [];
  return (
    <>
      <PageHead titulo="Revelações" texto="Eventos com revelação ainda não executada pelo servidor; atrasadas primeiro quando passam do horário." />
      {r.state !== "ok" ? <StateBox load={r} /> : <Table vazio="Nenhuma revelação pendente." cols={[{ k: "t", h: "Evento" }, { k: "h", h: "Anfitrião" }, { k: "a", h: "Revela em" }, { k: "s", h: "Estado" }]}
        rows={abertas.map((e) => ({ t: e.title, h: e.hostName, a: when(e.revealAt), s: <Badge s={e.revealState === "atrasada" ? "erro" : "aviso"}>{e.revealState}</Badge> }))} />}
    </>
  );
}
