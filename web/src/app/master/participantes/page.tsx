import { listArgs, type ListProps } from "../pagination";
import { num, requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table, ListSearchForm, ListPagination } from "../ui";

interface P { eventTitle: string; name: string; table: string | null; joinedAt: string; blocked: boolean; isHost: boolean }
interface I { eventTitle: string; label: string; uses: number; maxUses: number | null; state: string; expiresAt: string | null; createdAt: string }
export default async function Participantes({ searchParams }: ListProps) {
  const sp = await searchParams;
  const sb = await requireMaster();
  const [p, i] = await Promise.all([
    rpc<{ total: number; items: P[] }>(sb, "admin_search_participants", listArgs(sp)),
    rpc<{ total: number; items: I[] }>(sb, "admin_search_invites", listArgs(sp, "i")),
  ]);
  return (
    <>
      <PageHead titulo="Convites e participantes" texto="Quem entrou em cada evento e o estado dos convites. Tokens de convite nunca aparecem." />
      <ListSearchForm q={sp.q} />
      <h2 style={{ fontSize: 18 }}>Participantes {p.state === "ok" && <small>({num(p.data.total)})</small>}</h2>
      {p.state !== "ok" ? <StateBox load={p} /> : <><ListPagination total={p.data.total} sp={sp} label="Paginação de participantes" /><Table vazio="Nenhum participante." cols={[{ k: "e", h: "Evento" }, { k: "n", h: "Nome" }, { k: "m", h: "Mesa" }, { k: "j", h: "Entrou em" }, { k: "s", h: "Situação" }]}
        rows={p.data.items.map((x) => ({ e: x.eventTitle, n: x.name, m: x.table ?? "—", j: when(x.joinedAt), s: x.blocked ? <Badge s="erro">bloqueado</Badge> : x.isHost ? <Badge s="info">organizador</Badge> : <Badge s="ok">ativo</Badge> }))} /></>}
      <h2 style={{ fontSize: 18, marginTop: 32 }}>Convites {i.state === "ok" && <small>({num(i.data.total)})</small>}</h2>
      {i.state !== "ok" ? <StateBox load={i} /> : <><ListPagination total={i.data.total} sp={sp} pageKey="i" label="Paginação de convites" /><Table vazio="Nenhum convite." cols={[{ k: "e", h: "Evento" }, { k: "l", h: "Rótulo" }, { k: "u", h: "Usos", num: true }, { k: "x", h: "Expira" }, { k: "s", h: "Estado" }]}
        rows={i.data.items.map((x) => ({ e: x.eventTitle, l: x.label, u: `${num(x.uses)}${x.maxUses ? ` / ${num(x.maxUses)}` : ""}`, x: when(x.expiresAt), s: <Badge s={x.state === "ativo" ? "ok" : x.state === "revogado" ? "erro" : "aviso"}>{x.state}</Badge> }))} /></>}
    </>
  );
}
