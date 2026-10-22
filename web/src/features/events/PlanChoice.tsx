"use client";

import { useId } from "react";

/** Plano como o passo 4 o mostra. Hoje só o Grátis; o catálogo real (billing) alimenta `plans` depois. */
export interface PlanOption {
  code: string;
  title: string;
  detail: string;
  /** 0 = Grátis. */
  priceBrl: number;
}

export const FREE_PLAN_OPTION: PlanOption = { code: "gratis", title: "Até 10 · Grátis", detail: "Grátis · 10 fotos por pessoa", priceBrl: 0 };

/** Lista estática de hoje: só o Grátis. PONTO DE EXTENSÃO DE BILLING: trocar pela lista do catálogo público. */
export const STATIC_PLANS: PlanOption[] = [FREE_PLAN_OPTION];

export const PAID_PLAN_LINE = "O evento nasce grátis. Com plano pago, você paga no Pix na tela seguinte.";

export const hasPaidPlan = (plans: PlanOption[]) => plans.some((p) => p.priceBrl > 0);

/** PONTO DE EXTENSÃO DE BILLING: escolha de plano no passo 4 (props: plans, selected, onSelect). */
export function PlanChoice({ plans, selected, onSelect }: { plans: PlanOption[]; selected: string; onSelect: (code: string) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label="Plano do evento" className="app-stack-sm">
      {plans.map((p) => (
        <label key={p.code} className="app-card" style={{ cursor: "pointer", flexDirection: "row", alignItems: "center", gap: 12, outline: p.code === selected ? "2px solid var(--cor-acento)" : undefined }}>
          <input type="radio" name={name} value={p.code} checked={p.code === selected} onChange={() => onSelect(p.code)} />
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span className="titulo-card">{p.title}</span>
            <span className="app-muted">{p.detail}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
