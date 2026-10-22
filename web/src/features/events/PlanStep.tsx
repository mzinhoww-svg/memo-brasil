"use client";

import { useId } from "react";
import { Button, Skeleton } from "@/components/memoriesmt";
import { PlanCard } from "@/features/billing/PlanCard";
import { TrustBlock } from "@/features/billing/TrustBlock";
import type { PublicPlan, PublicSettings } from "@/features/billing/types";
import { hasPaidPlans } from "./plan-catalog";

export const PAID_PLAN_LINE = "O evento nasce grátis. Com plano pago, você paga no Pix na tela seguinte.";

type Props = { plans: PublicPlan[] | null; settings: PublicSettings | null; selected: string; onSelect: (code: string) => void; pendingCode: string | null };

/** Passo 4 (O4): planos do catálogo real, confiança do plano marcado e, sem plano pago ativo, o contato. */
export function PlanStep({ plans, settings, selected, onSelect, pendingCode }: Props) {
  const name = useId();
  if (!plans) return <Skeleton label="Carregando os planos…" />;
  const chosen = plans.find((p) => p.code === selected) ?? plans[0];
  const support = settings?.supportEmail;
  return (
    <div className="app-stack">
      {plans.length === 0 ? (
        <p className="app-p app-muted">Não deu para carregar os planos agora. O evento nasce grátis e você escolhe o plano depois, no painel.</p>
      ) : (
        <div className="plano-lista" role="radiogroup" aria-label="Plano do evento">
          {plans.map((p) => <PlanCard key={p.code} plan={p} name={name} selected={p.code === chosen?.code} onSelect={() => onSelect(p.code)} />)}
        </div>
      )}
      {!hasPaidPlans(plans) && (
        <section className="app-card" aria-labelledby="mais-gente">
          <h2 id="mais-gente" className="titulo-card app-h1">Evento maior?</h2>
          <p className="app-p app-muted">Os planos pagos voltam em breve. Fale com a gente e liberamos o seu evento.</p>
          {support && <Button href={`mailto:${support}?subject=${encodeURIComponent("Evento com mais convidados")}`} variant="secundario" block>Fale com a gente</Button>}
        </section>
      )}
      {chosen && <TrustBlock plan={chosen} gracePct={settings?.capacityGracePct ?? 10} />}
      {pendingCode && <p className="app-p" data-testid="codigo-pendente">Código {pendingCode} será aplicado ao criar.</p>}
    </div>
  );
}
