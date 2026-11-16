/** Pessoas (M15 a M19): formatação e mapeamento puros do que as RPCs devolvem para as linhas das tabelas do desenho. Fuso de Cuiabá, pt-BR. */
import { fullDay, relWhen } from "@/app/master/format";

export type PessoasAba = "contas" | "organizadores" | "convidados" | "convites" | "equipe";
export const ABAS: readonly { id: PessoasAba; label: string }[] = [
  { id: "contas", label: "Contas" }, { id: "organizadores", label: "Organizadores" }, { id: "convidados", label: "Convidados" },
  { id: "convites", label: "Convites" }, { id: "equipe", label: "Equipe" },
];
export const PER_PAGE = 25;
export const parseAba = (v: string | undefined): PessoasAba => (ABAS.find((a) => a.id === v)?.id ?? "contas");

export type Tone = "ok" | "bad" | "wait" | "info" | "mute";
export type PlatformRoleName = "master" | "support" | "auditor";

/** "15 mar 2027 02:00" (data e hora no fuso de Cuiabá). */
export function fullStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso))) p[x.type] = x.value.replace(/\.$/, "");
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`;
}

// ---------------------------------------------------------------- contas
export interface UserItem {
  userId: string; isAnonymous: boolean; provider: string; email: string | null; createdAt: string; lastSignInAt: string | null; platformRole: PlatformRoleName | null;
}
export interface ContaRow { id: string; kind: string; kindTone: Tone; email: string; created: string; last: string; role: PlatformRoleName | null }

/** Tipo da conta como o desenho escreve: Google, E-mail ou Convidado (conta anônima). */
export function accountKind(provider: string, anon: boolean): { label: string; tone: Tone } {
  if (anon) return { label: "Convidado", tone: "mute" };
  if (provider === "google") return { label: "Google", tone: "info" };
  if (provider === "email") return { label: "E-mail", tone: "mute" };
  return { label: provider || "—", tone: "mute" };
}
export const contaRows = (items: readonly UserItem[], now?: Date): ContaRow[] =>
  items.map((u) => {
    const k = accountKind(u.provider, u.isAnonymous);
    return { id: u.userId.slice(0, 8), kind: k.label, kindTone: k.tone, email: u.email ?? "—", created: fullDay(u.createdAt), last: relWhen(u.lastSignInAt, now), role: u.platformRole };
  });
export const roleTone = (r: PlatformRoleName | null): Tone => (r === "master" ? "ok" : "wait");

// ---------------------------------------------------------------- organizadores
export interface OrganizerItem {
  userId: string; displayName: string | null; email: string | null; provider: string; eventsCount: number; activeEvents: number; photos: number;
  lastEventAt: string | null; spendCents: number | null; deletionRequested: boolean;
}
export interface OrganizerRow { id: string; name: string; email: string; provider: string; events: string; active: string; photos: string; last: string; spend: string; deletion: boolean }
const nf = new Intl.NumberFormat("pt-BR");
const reais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const organizerRows = (items: readonly OrganizerItem[]): OrganizerRow[] =>
  items.map((o) => ({
    id: o.userId, name: o.displayName ?? "—", email: o.email ?? "—", provider: accountKind(o.provider, o.provider === "anonymous").label,
    events: nf.format(o.eventsCount), active: nf.format(o.activeEvents), photos: nf.format(o.photos), last: fullDay(o.lastEventAt),
    // gasto total só o master recebe (Pagamentos é área do master): para os demais papéis o servidor devolve nulo
    spend: o.spendCents === null ? "—" : `R$ ${reais.format(o.spendCents / 100)}`, deletion: o.deletionRequested,
  }));

// ---------------------------------------------------------------- convidados
export interface GuestItem { eventTitle: string; name: string; joinedAt: string | null; photos: number; situation: "ativo" | "organizador" | "bloqueado" }
export interface GuestRow { name: string; event: string; joined: string; photos: string; situation: GuestItem["situation"] }
export const SITUATION_TONE: Record<GuestItem["situation"], Tone> = { ativo: "ok", organizador: "info", bloqueado: "bad" };
export const guestRows = (items: readonly GuestItem[], now?: Date): GuestRow[] =>
  items.map((g) => ({ name: g.name, event: g.eventTitle, joined: relWhen(g.joinedAt, now), photos: nf.format(g.photos), situation: g.situation }));

// ---------------------------------------------------------------- convites (nunca há token nem hash aqui)
export interface InviteItem { eventTitle: string; label: string; uses: number; maxUses: number | null; expiresAt: string | null; state: "ativo" | "expirado" | "esgotado" | "revogado" }
export interface InviteRow { event: string; label: string; uses: string; expires: string; state: InviteItem["state"] }
export const INVITE_TONE: Record<InviteItem["state"], Tone> = { ativo: "ok", revogado: "mute", esgotado: "wait", expirado: "bad" };
export const inviteRows = (items: readonly InviteItem[]): InviteRow[] =>
  items.map((i) => ({ event: i.eventTitle, label: i.label, uses: `${nf.format(i.uses)} / ${i.maxUses === null ? "sem limite" : nf.format(i.maxUses)}`, expires: fullStamp(i.expiresAt), state: i.state }));

// ---------------------------------------------------------------- equipe
export interface TeamItem { userId: string; email: string | null; role: PlatformRoleName; grantedAt: string; grantedByEmail: string | null; installation: boolean; lastMaster: boolean }
export interface TeamRow { userId: string; email: string; role: PlatformRoleName; by: string; at: string; lastMaster: boolean }
export const teamRows = (items: readonly TeamItem[]): TeamRow[] =>
  items.map((t) => ({ userId: t.userId, email: t.email ?? "—", role: t.role, by: t.installation ? "instalação" : (t.grantedByEmail ?? "—"), at: fullStamp(t.grantedAt), lastMaster: t.lastMaster }));

// ---------------------------------------------------------------- filtros da URL (?f=) → argumento da RPC
export const USER_KIND: Record<string, string> = { equipe: "team", google: "google", email: "email", convidados: "anon" };
export const GUEST_FILTERS = ["ativos", "bloqueados", "organizadores"] as const;
export const INVITE_FILTERS = ["ativos", "expirados", "esgotados", "revogados"] as const;
export const CONTAS_FILTERS = ["equipe", "google", "email", "convidados"] as const;
export const validFilter = (aba: PessoasAba, f: string | undefined): string | undefined => {
  const ok = aba === "contas" ? CONTAS_FILTERS : aba === "convidados" ? GUEST_FILTERS : aba === "convites" ? INVITE_FILTERS : [];
  return f && (ok as readonly string[]).includes(f) ? f : undefined;
};

/** Texto do campo "Filtros" da folha Exportar. */
export function filtersText(aba: PessoasAba, f: string | undefined, q: string | undefined): string {
  const names: Record<string, string> = { equipe: "Equipe", google: "Google", email: "E-mail", convidados: "Convidados", ativos: "Ativos", bloqueados: "Bloqueados", organizadores: "Organizadores", expirados: "Expirados", esgotados: "Esgotados", revogados: "Revogados" };
  const label = aba === "contas" ? "Tipo" : aba === "convidados" ? "Situação" : "Estado";
  const parts = [f ? `${label}: ${names[f]}` : null, q ? `Busca: ${q}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nenhum filtro";
}

/** Erros das RPCs de equipe em português para a linha vermelha da folha. */
export function teamErrorText(code: string | undefined, message: string): string {
  if (code === "MM011" || /reasonrequired/.test(message)) return "Escreva o motivo com 10 a 500 caracteres.";
  if (code === "MM009") return "Sempre fica pelo menos um master: este é o último e não pode ser revogado.";
  if (code === "MM004" || /forbidden/.test(message)) return "Sem permissão para esta ação.";
  if (/notfound/.test(message)) return "Não achamos uma conta do Revela com esse e-mail. A pessoa precisa já ter conta.";
  if (/duplicate/.test(message)) return "Essa conta já tem este papel.";
  if (code === "MM005" || /invalid/.test(message)) return "Ação recusada pelo servidor: confira o e-mail, o papel e o estado atual da equipe.";
  return "Não foi possível concluir. Tente de novo.";
}
