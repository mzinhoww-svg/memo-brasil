import { listArgs, type ListProps } from "../pagination";
import { requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table, ListSearchForm, ListPagination } from "../ui";

interface U { userId: string; isAnonymous: boolean; provider: string; email: string | null; createdAt: string; lastSignInAt: string | null; platformRole: string | null }
export default async function Usuarios({ searchParams }: ListProps) {
  const sp = await searchParams;
  const sb = await requireMaster();
  const r = await rpc<{ total: number; items: U[] }>(sb, "admin_search_users", listArgs(sp));
  return (
    <>
      <PageHead titulo="Usuários" texto="Contas de autenticação: organizadores (Google) e convidados anônimos. Sem telefone nem metadados; e-mail completo só para master." />
      <ListSearchForm q={sp.q} />
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <ListPagination total={r.data.total} sp={sp} />
          <Table vazio="Nenhum usuário." cols={[{ k: "i", h: "ID" }, { k: "t", h: "Tipo" }, { k: "e", h: "E-mail" }, { k: "c", h: "Criado em" }, { k: "l", h: "Último acesso" }, { k: "p", h: "Papel" }]}
            rows={r.data.items.map((u) => ({ i: <code>{u.userId.slice(0, 8)}…</code>, t: u.isAnonymous ? <Badge s="info">convidado</Badge> : <Badge s="ok">{u.provider}</Badge>, e: u.email ?? "—", c: when(u.createdAt), l: when(u.lastSignInAt), p: u.platformRole ? <Badge s="aviso">{u.platformRole}</Badge> : "—" }))} />
        </>
      )}
    </>
  );
}
