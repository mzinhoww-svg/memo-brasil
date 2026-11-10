import { MState } from "@/revela/master-kit";
import { requireMaster, rpc } from "../data";
import { PricesEditor, type PlanImpact } from "./PricesEditor";
import type { PlanRow } from "../prices";

type Plan = PlanRow & { updatedAt: string; history: { at: string }[] };
interface Order { planCode: string; status: string; amountCents: number }

/** M03: planos e preços editáveis na tabela, prévia do paywall e publicação com o código do autenticador (M04). */
export default async function Planos() {
  const sb = await requireMaster();
  const [plans, settings, orders] = await Promise.all([
    rpc<Plan[]>(sb, "admin_list_plans"),
    rpc<{ payments_env: string }>(sb, "get_public_settings"),
    rpc<Order[]>(sb, "admin_list_payments", { p_limit: 200 }),
  ]);
  if (plans.state !== "ok") return <MState kind={plans.state === "denied" ? "denied" : "error"} text={plans.state === "error" ? `Não foi possível carregar: ${plans.message}` : undefined} />;
  const env = settings.state === "ok" ? settings.data.payments_env : "desligado";
  const impact: PlanImpact = {};
  for (const o of orders.state === "ok" ? orders.data : []) {
    const i = (impact[o.planCode] ??= { paid: 0, open: 0 });
    if (o.status === "pago") i.paid += 1;
    else if (o.status === "pendente") i.open += 1;
  }
  return <PricesEditor plans={plans.data.map(({ updatedAt: _u, history: _h, ...p }) => { void _u; void _h; return p; })} env={env} impact={impact} />;
}
