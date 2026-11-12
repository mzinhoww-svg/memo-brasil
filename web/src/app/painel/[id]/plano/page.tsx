"use client";

import { redirect, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/revela";
import { ScreenH1 } from "@/revela/painel-ui";
import { useAdmin } from "@/features/admin/context";
import {
  BillingError, BillingUnavailableError, ProviderUnavailableError, formatBRL, getPublicSettings, listPosePacks, listPublicPlans, openOrder, startCheckout,
} from "@/features/billing/api";
import { currentPlanCode } from "@/features/billing/entitlement";
import { PLAN_TEXT, checkoutErrorMessage, clearIdempotencyKey, idempotencyKeyFor, parseReturn, reconcileCheckout, type ReturnHint } from "@/features/billing/flow";
import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";
import { goToCheckout } from "@/features/billing/checkout-nav";
import { CheckoutPending, ProviderDown } from "@/features/billing/CheckoutPending";
import { PlanPicker } from "@/features/billing/PlanPicker";
import { CodeApplied } from "@/features/billing/RedeemCode";
import { basePlanCode, lookupPlans, packByCode } from "@/features/billing/pose-packs";
import type { OrderView, PosePack, PublicPlan, PublicSettings } from "@/features/billing/types";

const NO_SETTINGS: PublicSettings = { supportEmail: null, supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "desligado", capacityGracePct: 10 };

type Down = { planCode: string };

/**
 * COM-006: plano e pagamento no Checkout Pro do Mercado Pago (Pix ou cartão). A URL não carrega estado de pagamento:
 * o pedido é restaurado do servidor. `?retorno=` e os parâmetros do provedor são só dica de texto e saem da URL na leitura.
 */
export default function PlanoPage() {
  return <Suspense fallback={<div className="pf-pad"><Skeleton label="Abrindo o plano…" /></div>}><PlanoCorpo /></Suspense>;
}

function PlanoCorpo() {
  const { event, refresh, participants } = useAdmin();
  const initialPlan = useSearchParams()?.get("plano") ?? null;
  const eventId = event.id;
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [packs, setPacks] = useState<PosePack[]>([]);
  const [settings, setSettings] = useState<PublicSettings>(NO_SETTINGS);
  const [current, setCurrent] = useState("gratis");
  const [order, setOrder] = useState<OrderView | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [down, setDown] = useState<Down | null>(null);
  const [applied, setApplied] = useState<{ planCode: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sandboxPlan, setSandboxPlan] = useState<string | null>(null);
  const [returnHint, setReturnHint] = useState<ReturnHint | null>(null);
  const inflight = useRef(false);

  // retorno do checkout: lê a dica uma vez e limpa a URL; o estado mostrado vem de openOrder/orderStatus
  // lido UMA vez por montagem: sob StrictMode (dev) o efeito roda duas vezes e, na segunda, a URL já estaria limpa e a dica se perderia
  const [initialReturn] = useState(() => (typeof window === "undefined" ? null : parseReturn(window.location.search)));
  useEffect(() => {
    const r = initialReturn;
    if (!r) return;
    if (r.search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${r.search}${window.location.hash}`);
    if (r.hint) { const t = setTimeout(() => setReturnHint(r.hint), 0); return () => clearTimeout(t); }
  }, [initialReturn]);

  const load = useCallback(async () => {
    try {
      const [p, s, c, o, k] = await Promise.all([
        listPublicPlans(), getPublicSettings(), currentPlanCode(eventId),
        openOrder(eventId).catch((e) => { if (e instanceof BillingUnavailableError) return null; throw e; }),
        listPosePacks(),
      ]);
      setPlans(p); setPacks(k); setSettings(s); setCurrent(c); setOrder(o); setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [eventId]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  // buscas por código incluem as variantes "Mais poses" (ocultas do seletor)
  const lookup = useMemo(() => lookupPlans(plans ?? [], packs), [plans, packs]);
  const planName = useCallback((code: string) => lookup.find((p) => p.code === code)?.name ?? code, [lookup]);

  const onOrder = useCallback((o: OrderView) => {
    setOrder(o);
    if (o.status === "pago") { void currentPlanCode(eventId).then(setCurrent); void refresh(); }
  }, [eventId, refresh]);

  const pay = useCallback(async (planCode: string, fresh = false) => {
    if (inflight.current) return; // clique duplo: um pedido só
    if (validapayCheckoutEnabled()) {
      setSandboxPlan(planCode);
      return;
    }
    inflight.current = true;
    setBusy(true); setError(null); setDown(null);
    try {
      if (fresh) clearIdempotencyKey(eventId, planCode);
      const o = await startCheckout(eventId, planCode, idempotencyKeyFor(eventId, planCode));
      const r = reconcileCheckout(o, planCode);
      setOrder(r.order);
      setWarning(r.otherPlan ? PLAN_TEXT.outroPlano(planName(r.order.planCode)) : null);
      setReturnHint(null);
      // pedido aberto do plano escolhido: segue para o Mercado Pago; o de outro plano só é mostrado, com aviso
      if (!r.otherPlan && (r.order.status === "criado" || r.order.status === "pendente") && r.order.checkoutUrl) goToCheckout(r.order.checkoutUrl);
    } catch (e) {
      if (e instanceof ProviderUnavailableError) setDown({ planCode });
      else if (e instanceof BillingUnavailableError) { setError("Pagamentos indisponíveis no momento. Tente de novo mais tarde."); void load(); }
      else setError(checkoutErrorMessage(e instanceof BillingError ? e.code : "erro"));
    } finally {
      inflight.current = false; setBusy(false);
    }
  }, [eventId, load, planName]);

  const toPicker = useCallback(() => { setOrder(null); setWarning(null); setDown(null); setError(null); setReturnHint(null); }, []);

  if (sandboxPlan) redirect(`/painel/${encodeURIComponent(eventId)}/checkout-validapay?plano=${encodeURIComponent(sandboxPlan)}`);

  if (loadError) {
    return (
      <div className="plano-estado pf-pad"><ScreenH1 className="titulo-tela app-h1">Não deu para abrir o plano.</ScreenH1>
        <p className="app-p app-muted">Confira a conexão e tente de novo.</p>
        <button type="button" className="rv-btn rv-btn--primario rv-btn--bloco" onClick={() => void load()}><span>Tentar de novo</span></button>
      </div>
    );
  }
  if (!plans) return <div className="pf-pad"><Skeleton label="Abrindo o plano…" /></div>;

  const painel = `/painel/${eventId}`;
  let body;
  if (applied) {
    body = <CodeApplied plan={lookup.find((p) => p.code === applied.planCode)} code={applied.code} eventTitle={event.title} backHref={painel} printHref={`${painel}/qr`} />;
  } else if (down) {
    const p = lookup.find((x) => x.code === down.planCode);
    body = <ProviderDown planName={p?.name} amountLabel={p ? formatBRL(p.priceCents) : undefined} busy={busy} onRetry={() => void pay(down.planCode)} />;
  } else if (order) {
    body = <CheckoutPending order={order} plans={lookup} warning={warning} eventId={eventId} returnHint={returnHint} busy={busy} onOrder={onOrder} onChoosePlan={toPicker} onNewCheckout={() => void pay(order.planCode, true)} />;
  } else {
    body = (
      <PlanPicker eventId={eventId} plans={plans} currentCode={basePlanCode(packs, current)} packs={packs} hasPack={!!packByCode(packs, current)} settings={settings} busy={busy} error={error} initialPlan={initialPlan} usage={{ guests: participants?.length ?? 0, shots: event.shotsPerPerson ?? null }} onPay={(c) => void pay(c)}
        onRedeemed={(r) => { setApplied({ planCode: r.planCode ?? "", code: r.code }); void currentPlanCode(eventId).then(setCurrent); void refresh(); }} />
    );
  }
  return (
    <div className="plano-pagina pf-pad">
      {body}
    </div>
  );
}
