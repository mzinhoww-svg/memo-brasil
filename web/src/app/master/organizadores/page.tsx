import { listArgs, type ListProps } from "../pagination";
import { num, requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table, ListSearchForm, ListPagination } from "../ui";

interface Org { userId: string; displayName: string | null; email: string | null; eventsCount: number; activeEvents: number; lastEventAt: string | null; photos: number; deletionRequested: boolean }
export default async function Organizadores({ searchParams }: ListProps) {
  const sp = await searchParams;
  const sb = await requireMaster();
  const r = await rpc<{ total: number; items: Org[] }>(sb, "admin_list_organizers", listArgs(sp));
  return (
    <>
      <PageHead titulo="Organizadores" texto="E-mails aparecem mascarados, exceto para o papel master." />
      <ListSearchForm q={sp.q} />
      {r.state !== "ok" ? <StateBox load={r} /> : <><ListPagination total={r.data.total} sp={sp} /><Table vazio="Nenhum organizador ainda." cols={[{ k: "n", h: "Nome" }, { k: "e", h: "E-mail" }, { k: "c", h: "Eventos", num: true }, { k: "a", h: "Ativos", num: true }, { k: "f", h: "Fotos", num: true }, { k: "u", h: "Último evento" }, { k: "l", h: "LGPD" }]}
        rows={r.data.items.map((o) => ({ n: o.displayName ?? "—", e: o.email ?? "—", c: num(o.eventsCount), a: num(o.activeEvents), f: num(o.photos), u: when(o.lastEventAt), l: o.deletionRequested ? <Badge s="aviso">exclusão pedida</Badge> : "—" }))} /></>}
    </>
  );
}
