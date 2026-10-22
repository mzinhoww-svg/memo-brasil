"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/memoriesmt";
import { formatBRL, getPublicSettings, listPublicPlans, openOrder } from "@/features/billing/api";
import { currentPlanCode } from "@/features/billing/entitlement";
import type { OrderView, PublicPlan, PublicSettings } from "@/features/billing/types";

export type PlanInfo = { plans: PublicPlan[]; settings: PublicSettings | null; current: PublicPlan | null; order: OrderView | null; loaded: boolean };
const EMPTY: PlanInfo = { plans: [], settings: null, current: null, order: null, loaded: false };

/** Plano efetivo do evento + catálogo + pedido aberto. Falha de qualquer parte cai no Grátis do catálogo (piso). */
export function usePlanInfo(eventId: string, version?: unknown): PlanInfo {
  const [info, setInfo] = useState<PlanInfo>(EMPTY);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [plans, settings, code, order] = await Promise.all([
        listPublicPlans().catch(() => [] as PublicPlan[]),
        getPublicSettings().catch(() => null),
        currentPlanCode(eventId),
        openOrder(eventId).catch(() => null),
      ]);
      if (alive) setInfo({ plans, settings, current: plans.find((p) => p.code === code) ?? plans.find((p) => p.isFree) ?? null, order, loaded: true });
    })();
    return () => { alive = false; };
  }, [eventId, version]);
  return info;
}

const nf = (n: number) => n.toLocaleString("pt-BR");

export function PlanSummaryCard({ planName, guests, capacity, planHref, canUpgrade }: { planName: string; guests: number; capacity: number | null; planHref: string; canUpgrade: boolean }) {
  return (
    <section className="app-card" aria-labelledby="plano-atual" data-testid="cartao-plano">
      <h2 id="plano-atual" className="titulo-card app-h1">Plano</h2>
      <p className="app-p"><strong>{planName}</strong></p>
      <p className="app-p app-muted">{capacity === null ? `${nf(guests)} convidados, sem limite` : `${nf(guests)} de ${nf(capacity)} convidados`}</p>
      {canUpgrade && <Button variant="pequeno" href={planHref}>Aumentar</Button>}
    </section>
  );
}

export function CapacityBanner({ guests, capacity, limit, planHref }: { guests: number; capacity: number; limit: number; planHref: string }) {
  return (
    <section className="app-card" role="status" aria-labelledby="lotacao" data-testid="aviso-lotacao" style={{ borderColor: "var(--rec-texto)" }}>
      <p id="lotacao" className="eyebrow" style={{ color: "var(--rec-texto)" }}>LOTAÇÃO CHEGANDO</p>
      <p className="app-p"><strong>Lotação chegando: {nf(guests)} de {nf(capacity)}.</strong> Ninguém será barrado até {nf(limit)}.</p>
      <Button variant="pequeno" href={planHref}>Aumentar plano</Button>
    </section>
  );
}

export function PreEventChecklist({ eventId, eventCode, hasPhoto, order }: { eventId: string; eventCode: string; hasPhoto: boolean; order: OrderView | null }) {
  const pay = order && (order.status === "criado" || order.status === "pendente") ? order : null;
  const items: { done: boolean; label: React.ReactNode }[] = [
    { done: true, label: "Evento criado" },
    { done: hasPhoto, label: <Link href={`/e/${eventCode}`}>Tire a primeira foto como convidado</Link> },
    { done: false, label: <Link href={`/painel/${eventId}/qr`}>Imprima os cards das mesas</Link> },
    ...(pay ? [{ done: false, label: <Link href={`/painel/${eventId}/plano`}>Pague o plano no Pix · {formatBRL(pay.amountCents)}</Link> }] : []),
  ];
  return (
    <section className="app-card" aria-labelledby="antes" data-testid="checklist">
      <h2 id="antes" className="titulo-card app-h1">Antes do grande dia</h2>
      <ul className="app-stack-sm" style={{ padding: 0, margin: 0, listStyle: "none" }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", minHeight: 44 }}>
            <span aria-hidden="true">{it.done ? "✓" : "○"}</span>
            <span className="app-p">{it.label}<span className="sr-only">{it.done ? " (feito)" : " (pendente)"}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
