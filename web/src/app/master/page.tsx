import { MState } from "@/revela/master-kit";
import { MasterVisaoView, type PayRow } from "@/revela/screens/MasterVisao";
import { brl, orderStatus } from "./billing";
import { requireMaster, rpc } from "./data";
import { methodLabel, pct, relWhen, toneOf } from "./format";

interface Kpi { value: number | null; previous: number | null; spark: number[] }
interface Overview {
  days: number; generatedAt: string;
  kpis: { activeEvents: Kpi; photos: Kpi; revenueCents: Kpi };
  series: { day: string; photos: number }[];
  upcomingReveals: { revealAt: string | null }[];
}
interface Order { orderId: string; createdAt: string; eventTitle: string | null; planCode: string; planName: string | null; amountCents: number; status: string; paymentMethod?: string | null; refundRequestedAt: string | null; needsRefund: boolean }
interface Summary { byStatus: Record<string, { count: number; amountCents: number }> }

const PERIODOS = [7, 30] as const;
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" });

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const sb = await requireMaster();
  const q = Number((await searchParams).dias);
  const dias: 7 | 30 = q === 7 ? 7 : 30;
  const [o, s, list] = await Promise.all([
    rpc<Overview>(sb, "admin_overview", { p_days: dias }),
    rpc<Summary>(sb, "admin_payments_summary"),
    rpc<Order[]>(sb, "admin_list_payments", { p_limit: 200 }),
  ]);
  if (o.state !== "ok") return <MState kind={o.state === "denied" ? "denied" : "error"} text={o.state === "error" ? `Não foi possível carregar: ${o.message}` : undefined} />;
  const k = o.data.kpis;
  const rev = k.revenueCents.value ?? 0;
  const prev = k.revenueCents.previous ?? 0;
  const delta = prev > 0 ? `${rev >= prev ? "+" : "−"}${Math.round((Math.abs(rev - prev) / prev) * 100)}% sobre o período anterior` : `últimos ${dias} dias`;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Cuiaba" });
  const revealToday = o.data.upcomingReveals.filter((r) => r.revealAt && new Date(r.revealAt).toLocaleDateString("en-CA", { timeZone: "America/Cuiaba" }) === today).length;
  const photosToday = o.data.series.at(-1)?.photos ?? 0;
  const pend = s.state === "ok" ? s.data.byStatus.pendente : undefined;
  const spark = k.revenueCents.spark;
  const max = Math.max(0, ...spark);
  const bars = spark.map((v, i) => ({ pct: pct(v, max), label: (i + 1) % 5 === 0 ? String(new Date(`${o.data.series[i]?.day ?? ""}T12:00:00`).getDate()) : undefined, on: max > 0 && v === max }));
  const orders = list.state === "ok" ? list.data : [];
  const sold = new Map<string, { name: string; count: number }>();
  for (const x of orders.filter((x) => x.status === "pago")) sold.set(x.planCode, { name: x.planName ?? x.planCode, count: (sold.get(x.planCode)?.count ?? 0) + 1 });
  const top = Math.max(0, ...[...sold.values()].map((p) => p.count));
  const payments: PayRow[] = orders.slice(0, 3).map((x) => {
    const st = orderStatus(x);
    return { key: x.orderId, when: relWhen(x.createdAt), event: x.eventTitle ?? "Evento excluído", plan: x.planName ?? x.planCode, method: methodLabel(x.paymentMethod), amount: brl(x.amountCents), tone: toneOf(st.tone), status: st.label[0].toUpperCase() + st.label.slice(1) };
  });
  return (
    <MasterVisaoView
      caption={`Últimos ${dias} dias · atualizado ${relWhen(o.data.generatedAt)} (${dia(o.data.generatedAt)})`}
      tiles={[
        { label: `Receita (${dias} dias)`, value: brl(rev, { compact: true }), note: delta },
        { label: "Eventos ativos", value: String(k.activeEvents.value ?? 0), note: revealToday ? `${revealToday} ${revealToday === 1 ? "revela" : "revelam"} hoje` : "nenhuma revelação hoje" },
        { label: "Fotos hoje", value: new Intl.NumberFormat("pt-BR").format(photosToday), note: `${new Intl.NumberFormat("pt-BR").format(k.photos.value ?? 0)} em ${dias} dias` },
        { label: "Pedidos pendentes", value: String(pend?.count ?? 0), note: pend?.count ? `${brl(pend.amountCents)} aguardando` : "nada aguardando" },
      ]}
      bars={bars} days={dias} periodHref={(d) => `/master?dias=${d}`}
      plans={[...sold.values()].map((p) => ({ name: p.name, count: p.count, pct: pct(p.count, top) }))}
      payments={payments} allHref="/master/pagamentos" exportHref={null}
    />
  );
}
