import { MState } from "@/revela/master-kit";
import { ExportButton } from "../ExportButton";
import { MasterPessoasView } from "@/revela/screens/MasterPessoas";
import { brl } from "../billing";
import { requireMaster, rpc } from "../data";
import { monthYear, nf, relWhen } from "../format";

interface Org { userId: string; displayName: string | null; email: string | null; eventsCount: number; firstEventAt: string | null; deletionRequested: boolean }
interface Users { total: number; items: { userId: string; isAnonymous: boolean; provider: string; email: string | null; createdAt: string; platformRole: string | null }[] }
interface Parts { total: number; items: { eventTitle: string; name: string; table: string | null; joinedAt: string; blocked: boolean; isHost: boolean }[] }
interface Order { hostId: string | null; status: string; amountCents: number }

const PROVIDER: Record<string, string> = { google: "Google", email: "Link por e-mail", anonymous: "Convidado" };
const POR = 25;

/** M10 · Pessoas: organizadores, convidados e equipe. Mesmos dados e limites das telas antigas (e-mail mascarado para quem não é master). */
export default async function Pessoas({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; p?: string }> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const aba = sp.aba === "convidados" || sp.aba === "equipe" ? sp.aba : "organizadores";
  const p = Math.max(1, Number(sp.p) || 1);
  const q = sp.q?.slice(0, 80) || null;
  const [orgs, parts, users, orders] = await Promise.all([
    rpc<{ total: number; items: Org[] }>(sb, "admin_list_organizers", { p_limit: aba === "organizadores" ? POR : 1, p_offset: aba === "organizadores" ? (p - 1) * POR : 0, p_search: aba === "organizadores" ? q : null }),
    rpc<Parts>(sb, "admin_search_participants", { p_limit: aba === "convidados" ? POR : 1, p_offset: aba === "convidados" ? (p - 1) * POR : 0, p_search: aba === "convidados" ? q : null }),
    rpc<Users>(sb, "admin_list_users_v2", { p_limit: 200, p_kind: null }),
    rpc<Order[]>(sb, "admin_list_payments", { p_limit: 500 }),
  ]);
  if (orgs.state !== "ok") return <MState kind={orgs.state === "denied" ? "denied" : "error"} text={orgs.state === "error" ? `Não foi possível carregar: ${orgs.message}` : undefined} />;
  const people = users.state === "ok" ? users.data.items : [];
  const byUser = new Map(people.map((u) => [u.userId, u]));
  const team = people.filter((u) => u.platformRole);
  const spend = new Map<string, number>();
  for (const o of orders.state === "ok" ? orders.data : []) if (o.hostId && o.status === "pago") spend.set(o.hostId, (spend.get(o.hostId) ?? 0) + o.amountCents);
  const href = (a: string, page = 1) => `/master/pessoas?${new URLSearchParams({ aba: a, ...(q ? { q } : {}), ...(page > 1 ? { p: String(page) } : {}) })}`;
  const tabs = [
    { label: `Organizadores ${nf(orgs.data.total)}`, href: href("organizadores"), on: aba === "organizadores" },
    { label: `Convidados ${nf(parts.state === "ok" ? parts.data.total : 0)}`, href: href("convidados"), on: aba === "convidados" },
    { label: `Equipe ${nf(team.length)}`, href: href("equipe"), on: aba === "equipe" },
  ];
  const total = aba === "organizadores" ? orgs.data.total : aba === "convidados" && parts.state === "ok" ? parts.data.total : 0;
  const last = Math.max(1, Math.ceil(total / POR));
  const pager = aba !== "equipe" && last > 1 ? (
    <nav aria-label="Paginação" className="row" style={{ gap: "12px", marginTop: "16px", alignItems: "center" }}>
      {p > 1 && <a className="link" href={href(aba, p - 1)}>← Anterior</a>}
      <span className="rv-caption">Página {p} de {last} · {nf(total)} registros</span>
      {p < last && <a className="link" href={href(aba, p + 1)}>Próxima →</a>}
    </nav>
  ) : undefined;

  const exp = <ExportButton kind="pessoas" screen={`pessoas-${aba}`} filters={{ aba, q: aba === "equipe" ? undefined : q }} />;
  if (aba === "convidados") {
    return (
      <MasterPessoasView tabs={tabs} exportAction={exp} pager={pager} cols="1.4fr 1.4fr .8fr 1fr .8fr" head={["Nome", "Evento", "Mesa", "Entrou", "Situação"]}
        rows={parts.state === "ok" ? parts.data.items.map((x, i) => ({ key: `${i}-${x.name}`, cells: [x.name, x.eventTitle, x.table ?? "—", relWhen(x.joinedAt), x.blocked ? "bloqueado" : x.isHost ? "organizador" : "ativo"] })) : []}
        caption="Quem entrou em cada evento. Sem telefone, e-mail nem fotos." />
    );
  }
  if (aba === "equipe") {
    return (
      <MasterPessoasView tabs={tabs} exportAction={exp} cols="1.6fr 1.2fr 1fr" head={["E-mail", "Papel", "Desde"]}
        rows={team.map((u) => ({ key: u.userId, cells: [u.email ?? `${u.userId.slice(0, 8)}…`, u.platformRole ?? "—", monthYear(u.createdAt)] }))} caption="Contas com papel de operador da plataforma." empty="Nenhuma conta da equipe listada." />
    );
  }
  return (
    <MasterPessoasView tabs={tabs} exportAction={exp} pager={pager}
      rows={orgs.data.items.map((o) => ({
        key: o.userId,
        cells: [`${o.displayName ?? "—"}${o.deletionRequested ? " · exclusão pedida" : ""}`, o.email ?? "—", PROVIDER[byUser.get(o.userId)?.provider ?? ""] ?? "—", nf(o.eventsCount), brl(spend.get(o.userId) ?? 0), monthYear(o.firstEventAt)],
      }))}
      empty="Nenhum organizador ainda." />
  );
}
