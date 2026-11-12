import { requireRole, rpc, type Load } from "../data";
import { pageNumber } from "../pagination";
import { MasterPessoasContasView } from "@/revela/screens/MasterPessoasContas";
import { MasterPessoasConvidadosView } from "@/revela/screens/MasterPessoasConvidados";
import { MasterPessoasConvitesView } from "@/revela/screens/MasterPessoasConvites";
import { MasterPessoasOrganizadoresView } from "@/revela/screens/MasterPessoasOrganizadores";
import { PessoasStatePage, pessoasHref, type ChipItem, type PessoasQuery, type TabCounts } from "@/revela/screens/MasterPessoasKit";
import {
  PER_PAGE, USER_KIND, contaRows, guestRows, inviteRows, organizerRows, parseAba, teamRows, validFilter, type GuestItem, type InviteItem, type OrganizerItem, type PessoasAba, type TeamItem, type UserItem,
} from "@/lib/master/people";
import { EquipeClient } from "./EquipeClient";
import { PessoasExport } from "./PessoasExport";

interface Page<T> { total: number; items: T[] }
interface Counts { accounts: number; organizers: number; guests: number; invites: number; team: number }

/** Pessoas (M15 a M19): contas, organizadores, convidados, convites e equipe. Cada aba lê a sua RPC (o servidor mascara o e-mail por papel) e mostra
 *  os quatro estados do desenho. Equipe é só do master (a RPC nega o resto com MM004 e a aba mostra "sem permissão"). */
export default async function Pessoas({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; p?: string; f?: string }> }) {
  const gate = await requireRole("pessoas");
  if ("denied" in gate) return gate.denied;
  const { sb, role } = gate;
  const sp = await searchParams;
  const aba = parseAba(sp.aba);
  const page = pageNumber(sp.p);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const f = validFilter(aba, sp.f);
  const query: PessoasQuery = { f, q };
  const range = { p_limit: PER_PAGE, p_offset: (page - 1) * PER_PAGE };

  const countsReq = rpc<Counts>(sb, "admin_people_counts");
  const listReq: Promise<Load<unknown>> =
    aba === "contas" ? rpc<Page<UserItem> & { summary: Record<string, number> }>(sb, "admin_list_users_v2", { ...range, p_kind: f ? USER_KIND[f] : null, p_search: q ?? null })
    : aba === "organizadores" ? rpc<Page<OrganizerItem> & { summary: { deletionPending: number } }>(sb, "admin_list_organizers", { ...range, p_search: q ?? null })
    : aba === "convidados" ? rpc<Page<GuestItem> & { summary: Record<string, number> }>(sb, "admin_search_participants_v2", { ...range, p_search: q ?? null, p_situation: f ?? null })
    : aba === "convites" ? rpc<Page<InviteItem> & { summary: Record<string, number> }>(sb, "admin_search_invites_v2", { ...range, p_search: q ?? null, p_state: f ?? null })
    : rpc<{ items: TeamItem[] }>(sb, "admin_list_team");
  const [c, list] = await Promise.all([countsReq, listReq]);
  const counts: TabCounts | undefined = c.state === "ok"
    ? { contas: c.data.accounts, organizadores: c.data.organizers, convidados: c.data.guests, convites: c.data.invites, equipe: c.data.team }
    : undefined;

  // Exportar: só master e auditor (a RPC nega o support); a aba Equipe não exporta
  const canExport = (role === "master" || role === "auditor") && aba !== "equipe";
  const exportFor = (rows: number) => (canExport ? <PessoasExport aba={aba} f={f} q={q} rows={rows} /> : null);

  if (list.state !== "ok") {
    const variant = list.state === "denied" ? "denied" : "error";
    return <PessoasStatePage aba={aba} variant={variant} counts={counts} live exportAction={aba === "equipe" ? null : exportFor(0)} />;
  }
  const data = list.data as Page<unknown> & { summary?: Record<string, number> };

  if (aba === "equipe") {
    return <EquipeClient rows={teamRows((list.data as { items: TeamItem[] }).items)} counts={counts} />;
  }
  if (!data.items.length) return <PessoasStatePage aba={aba} variant="empty" counts={counts} live exportAction={exportFor(data.total)} />;

  const chip = (label: string, n: number, key: string | undefined): ChipItem => ({ label, n, on: f === key, href: pessoasHref(aba as PessoasAba, { f: key, q }) });
  const common = { counts, query, page, total: data.total, live: true, exportAction: exportFor(data.total) };
  const s = data.summary ?? {};

  if (aba === "contas") {
    return <MasterPessoasContasView {...common} rows={contaRows(data.items as UserItem[])}
      chips={[chip("Todas", counts?.contas ?? 0, undefined), chip("Equipe", s.team ?? 0, "equipe"), chip("Google", s.google ?? 0, "google"), chip("E-mail", s.email ?? 0, "email"), chip("Convidados", s.anon ?? 0, "convidados")]}
      orphans={!f || f === "convidados" ? (s.orphanAnon ?? 0) : null} />;
  }
  if (aba === "organizadores") {
    return <MasterPessoasOrganizadoresView {...common} rows={organizerRows(data.items as OrganizerItem[])} deletionPending={s.deletionPending ?? 0} />;
  }
  if (aba === "convidados") {
    return <MasterPessoasConvidadosView {...common} rows={guestRows(data.items as GuestItem[])}
      chips={[chip("Todos", s.total ?? 0, undefined), chip("Ativos", s.ativos ?? 0, "ativos"), chip("Bloqueados", s.bloqueados ?? 0, "bloqueados"), chip("Organizadores", s.organizadores ?? 0, "organizadores")]} />;
  }
  return <MasterPessoasConvitesView {...common} rows={inviteRows(data.items as InviteItem[])}
    chips={[chip("Todos", s.total ?? 0, undefined), chip("Ativos", s.ativos ?? 0, "ativos"), chip("Expirados", s.expirados ?? 0, "expirados"), chip("Esgotados", s.esgotados ?? 0, "esgotados"), chip("Revogados", s.revogados ?? 0, "revogados")]} />;
}
