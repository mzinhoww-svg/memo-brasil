import { MasterState, MasterStatePage } from "@/revela/master";
import { MasterVisaoAtividadeView, type AtividadeRow } from "@/revela/screens/MasterVisaoAtividade";
import { ExportSheetButton } from "./ExportSheetButton";
import { brl } from "./billing";
import { requireRole, rpc, type Load } from "./data";
import { nf } from "./format";
import { barsOf, failureSpike, monthCaption, weekdayDay, windowFromDays } from "./visao-eventos-format";

interface Kpi { value: number | null; previous: number | null }
interface Overview { kpis: { activeEvents: Kpi; photos: Kpi; revenueCents: Kpi }; series: { day: string; photos: number }[]; upcomingReveals: { revealAt: string | null }[] }
interface Day { day: string; eventsCreated: number; participantsJoined: number; photosUploaded: number; uploadsFailed: number }
interface Metrics { series: Day[] }
interface Summary { byStatus: Record<string, { count: number; amountCents: number }> }

const TZ = "America/Cuiaba";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const BLOCK_STATE = (l: Load<unknown>) => (l.state === "denied" ? <MasterState variant="denied" /> : <MasterState variant="error" />);

export type Search = Promise<{ dias?: string; vista?: string }>;

/** M20 · Visão geral com "Atividade por dia" (substitui a M01 e a rota analytics). Cada bloco trata o próprio `denied`: receita e pedidos pendentes são só do master. */
export async function VisaoGeralConteudo({ searchParams }: { searchParams: Search }) {
  const gate = await requireRole("visao");
  if ("denied" in gate) return gate.denied;
  const { sb, role } = gate;
  const sp = await searchParams;
  const dias: 7 | 30 = sp.dias === "30" ? 30 : sp.dias === "7" ? 7 : 30;
  const mode = sp.vista === "tabela" ? "tabela" : "barras";
  const now = new Date();
  const monthDays = Number(dayKey(now).slice(8, 10));
  const win = windowFromDays(dias, now);
  const master = role === "master";
  const [o, m, s] = await Promise.all([
    rpc<Overview>(sb, "admin_overview", { p_days: monthDays }),
    rpc<Metrics>(sb, "admin_dashboard_metrics", { p_from: win.from, p_to: win.to }),
    master ? rpc<Summary>(sb, "admin_payments_summary") : Promise.resolve<Load<Summary>>({ state: "denied" }),
  ]);
  const caption = monthCaption(now);
  if (o.state !== "ok") return <MasterStatePage area="Visão geral" variant={o.state === "denied" ? "denied" : "error"} />;

  const canExport = role === "master" || role === "auditor";
  const exportAction = canExport ? (
    <ExportSheetButton kind="visao" screen="visao" screenLabel="Visão geral" filters={{ dias }} period={`${dayKeyBr(win.from)} a ${dayKeyBr(now.toISOString())}`} filtersText={`Período: ${dias} dias · Eventos de teste: fora`} rowsEstimate={dias} />
  ) : null;

  const series = m.state === "ok" ? m.data.series.slice(-dias) : [];
  const totals = { ev: sum(series.map((d) => d.eventsCreated)), jo: sum(series.map((d) => d.participantsJoined)), ph: sum(series.map((d) => d.photosUploaded)), fa: sum(series.map((d) => d.uploadsFailed)) };
  if (m.state === "ok" && totals.ev + totals.jo + totals.ph + totals.fa === 0) {
    return <MasterStatePage area="Visão geral" variant="empty" caption={caption} title="Sem atividade neste período" text="Nenhum evento, entrada ou foto nos dias escolhidos." actions={exportAction} />;
  }

  const k = o.data.kpis;
  const rev = k.revenueCents.value;
  const prev = k.revenueCents.previous ?? 0;
  const today = dayKey(now);
  const revealToday = o.data.upcomingReveals.filter((r) => r.revealAt && dayKey(new Date(r.revealAt)) === today).length;
  const photosToday = o.data.series.at(-1)?.photos ?? 0;
  const pend = s.state === "ok" ? s.data.byStatus.pendente : undefined;
  const tiles = [
    rev === null
      ? { label: "Receita do mês", value: "—", note: "só para master" }
      : { label: "Receita do mês", value: brl(rev, { compact: true }), note: prev > 0 ? `${rev >= prev ? "+" : "−"}${Math.round((Math.abs(rev - prev) / prev) * 100)}% sobre o período anterior` : "mês até hoje" },
    { label: "Eventos ativos", value: nf(k.activeEvents.value), note: revealToday ? `${revealToday} ${revealToday === 1 ? "revela" : "revelam"} hoje` : "nenhuma revelação hoje" },
    { label: "Fotos hoje", value: nf(photosToday), note: `${nf(k.photos.value)} no mês` },
    s.state === "ok"
      ? { label: "Pedidos pendentes", value: nf(pend?.count ?? 0), note: pend?.count ? "Pix aguardando" : "nada aguardando" }
      : { label: "Pedidos pendentes", value: "—", note: s.state === "denied" ? "só para master" : "não carregou" },
  ];
  const href = (d: number, v: string) => `/master?dias=${d}${v === "tabela" ? "&vista=tabela" : ""}`;
  const falhas = series.map((d) => d.uploadsFailed);
  const rows: AtividadeRow[] = [...series].reverse().map((d) => ({
    key: d.day, cells: [weekdayDay(d.day), nf(d.eventsCreated), nf(d.participantsJoined), nf(d.photosUploaded), nf(d.uploadsFailed)], failuresBad: failureSpike(d.uploadsFailed, falhas),
  }));
  return (
    <MasterVisaoAtividadeView
      caption={caption}
      tiles={tiles} days={dias} mode={mode} periodHref={(d) => href(d, mode)} modeHref={(v) => href(dias, v)} exportAction={exportAction}
      activityState={m.state === "ok" ? undefined : BLOCK_STATE(m)}
      series={[
        { label: "Eventos criados", total: nf(totals.ev), bars: barsOf(series.map((d) => d.eventsCreated)) },
        { label: "Entradas de convidados", total: nf(totals.jo), bars: barsOf(series.map((d) => d.participantsJoined)) },
        { label: "Fotos", total: nf(totals.ph), bars: barsOf(series.map((d) => d.photosUploaded)) },
        { label: "Falhas de upload", total: nf(totals.fa), bars: barsOf(falhas), warn: true },
      ]}
      rows={rows}
    />
  );
}

/** "06 nov 2026" a partir de um instante, no fuso de Cuiabá. */
function dayKeyBr(iso: string): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }).formatToParts(new Date(iso))) p[x.type] = x.value.replace(/\.$/, "");
  return `${p.day} ${p.month} ${p.year}`;
}
