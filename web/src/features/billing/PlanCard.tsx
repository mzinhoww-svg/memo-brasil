import { formatBRL } from "./api";
import type { PublicPlan } from "./types";

/** Opção de plano (radio nativo dentro do rótulo). Preço sempre do servidor via formatBRL. */
export function PlanCard({ plan, name, selected, disabled, badge, onSelect }: { plan: PublicPlan; name: string; selected: boolean; disabled?: boolean; badge?: string; onSelect: () => void }) {
  const upTo = plan.maxGuests === null ? "Sem limite" : `Até ${plan.maxGuests}`;
  const price = plan.isFree ? "Grátis" : formatBRL(plan.priceCents);
  const shots = plan.maxShots === null ? "fotos sem limite" : `${plan.maxShots} fotos por pessoa`;
  return (
    <label className="plano-card" data-selected={selected || undefined} data-disabled={disabled || undefined}>
      <input type="radio" name={name} value={plan.code} checked={selected} disabled={disabled} onChange={onSelect} className="plano-radio" />
      <span className="plano-card-corpo">
        <span className="plano-card-titulo">{upTo} · {price}</span>
        <span className="plano-card-sub">{plan.name} · {shots}</span>
        {plan.features.length > 0 && <span className="plano-card-sub">{plan.features.join(" · ")}</span>}
      </span>
      {badge && <span className="plano-badge">{badge}</span>}
    </label>
  );
}
