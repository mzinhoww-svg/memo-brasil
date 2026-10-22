"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/memoriesmt";
import { useAdmin } from "@/features/admin/context";
import {
  BillingError, BillingUnavailableError, ProviderUnavailableError, formatBRL, getPublicSettings, listPublicPlans, openOrder, startCheckout,
} from "@/features/billing/api";
import { currentPlanCode } from "@/features/billing/entitlement";
import { PLAN_TEXT, checkoutErrorMessage, clearIdempotencyKey, idempotencyKeyFor, reconcileCheckout } from "@/features/billing/flow";
import { PixCheckout, ProviderDown } from "@/features/billing/PixCheckout";
import { PlanPicker } from "@/features/billing/PlanPicker";
import { CodeApplied } from "@/features/billing/RedeemCode";
import type { OrderView, PublicPlan, PublicSettings } from "@/features/billing/types";

const NO_SETTINGS: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "desligado", capacityGracePct: 10 };

type Down = { planCode: string };

/** COM-006: plano e pagamento Pix. A URL não carrega estado de pagamento: o pedido é restaurado do servidor. */
export default function PlanoPage() {
  const { event, refresh } = useAdmin();
  const eventId = event.id;
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [settings, setSettings] = useState<PublicSettings>(NO_SETTINGS);
  const [current, setCurrent] = useState("gratis");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [down, setDown] = useState<Down | null>(null);
  const [applied, setApplied] = useState<{ planCode: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    try {
      const [p, s, c, o] = await Promise.all([
        listPublicPlans(), getPublicSettings(), currentPlanCode(eventId),
        openOrder(eventId).catch((e) => { if (e instanceof BillingUnavailableError) return null; throw e; }),
      ]);
      setPlans(p); setSettings(s); setCurrent(c); setOrder(o); setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [eventId]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const planName = useCallback((code: string) => plans?.find((p) => p.code === code)?.name ?? code, [plans]);

  const onOrder = useCallback((o: OrderView) => {
    setOrder(o);
    if (o.status === "pago") { void currentPlanCode(eventId).then(setCurrent); void refresh(); }
  }, [eventId, refresh]);

  const pay = useCallback(async (planCode: string, fresh = false) => {
    if (inflight.current) return; // clique duplo: um pedido só
    inflight.current = true;
    setBusy(true); setError(null); setDown(null);
    try {
      if (fresh) clearIdempotencyKey(eventId, planCode);
      const o = await startCheckout(eventId, planCode, idempotencyKeyFor(eventId, planCode));
      const r = reconcileCheckout(o, planCode);
      setOrder(r.order);
      setWarning(r.otherPlan ? PLAN_TEXT.outroPlano(planName(r.order.planCode)) : null);
    } catch (e) {
      if (e instanceof ProviderUnavailableError) setDown({ planCode });
      else if (e instanceof BillingUnavailableError) { setError("Pagamentos indisponíveis no momento. Tente de novo mais tarde."); void load(); }
      else setError(checkoutErrorMessage(e instanceof BillingError ? e.code : "erro"));
    } finally {
      inflight.current = false; setBusy(false);
    }
  }, [eventId, load, planName]);

  const toPicker = useCallback(() => { setOrder(null); setWarning(null); setDown(null); setError(null); }, []);

  if (loadError) {
    return (
      <div className="plano-estado"><h1 className="titulo-tela app-h1">Não deu para abrir o plano.</h1>
        <p className="app-p app-muted">Confira a conexão e tente de novo.</p>
        <button type="button" className="mm-btn mm-btn--primario mm-btn--bloco" onClick={() => void load()}><span>Tentar de novo</span></button>
      </div>
    );
  }
  if (!plans) return <Skeleton label="Abrindo o plano…" />;

  const painel = `/painel/${eventId}`;
  let body;
  if (applied) {
    body = <CodeApplied plan={plans.find((p) => p.code === applied.planCode)} code={applied.code} eventTitle={event.title} backHref={painel} printHref={`${painel}/qr`} />;
  } else if (down) {
    const p = plans.find((x) => x.code === down.planCode);
    body = <ProviderDown planName={p?.name} amountLabel={p ? formatBRL(p.priceCents) : undefined} busy={busy} onRetry={() => void pay(down.planCode)} />;
  } else if (order) {
    body = <PixCheckout order={order} plans={plans} warning={warning} eventId={eventId} busy={busy} onOrder={onOrder} onChoosePlan={toPicker} onNewPix={() => void pay(order.planCode, true)} />;
  } else {
    body = (
      <PlanPicker eventId={eventId} plans={plans} currentCode={current} settings={settings} busy={busy} error={error} onPay={(c) => void pay(c)}
        onRedeemed={(r) => { setApplied({ planCode: r.planCode ?? "", code: r.code }); void currentPlanCode(eventId).then(setCurrent); void refresh(); }} />
    );
  }
  return (
    <div className="plano-pagina">
      <p className="plano-eyebrow">{event.title} · Plano</p>
      {body}
    </div>
  );
}
