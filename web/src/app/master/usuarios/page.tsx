import { num, requireMaster, rpc, when } from "../data";
import { Badge, PageHead, StateBox, Table } from "../ui";

interface U { userId: string; isAnonymous: boolean; provider: string; email: string | null; createdAt: string; lastSignInAt: string | null; platformRole: string | null }
export default async function Usuarios() {
  const sb = await requireMaster();
  const r = await rpc<{ total: number; items: U[] }>(sb, "admin_list_users", { p_limit: 100, p_offset: 0 });
  return (
    <>
      <PageHead titulo="Usuários" texto="Contas de autenticação: organizadores (Google) e convidados anônimos. Sem telefone nem metadados; e-mail completo só para master." />
      {r.state !== "ok" ? <StateBox load={r} /> : (
        <>
          <p className="adm-nota">{num(r.data.total)} usuários no total; mostrando os 100 mais recentes.</p>
          <Table vazio="Nenhum usuário." cols={[{ k: "i", h: "ID" }, { k: "t", h: "Tipo" }, { k: "e", h: "E-mail" }, { k: "c", h: "Criado em" }, { k: "l", h: "Último acesso" }, { k: "p", h: "Papel" }]}
            rows={r.data.items.map((u) => ({ i: <code>{u.userId.slice(0, 8)}…</code>, t: u.isAnonymous ? <Badge s="info">convidado</Badge> : <Badge s="ok">{u.provider}</Badge>, e: u.email ?? "—", c: when(u.createdAt), l: when(u.lastSignInAt), p: u.platformRole ? <Badge s="aviso">{u.platformRole}</Badge> : "—" }))} />
        </>
      )}
    </>
  );
}
