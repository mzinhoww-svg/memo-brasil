import { num, pct } from "@/features/master/format";

export interface FunnelStep { label: string; value: number }

/** Funil horizontal: largura relativa à primeira etapa; conversão sobre a etapa anterior. */
export function Funnel({ steps }: { steps: readonly FunnelStep[] }) {
  const top = steps[0]?.value || 0;
  return (
    <ol className="adm-funnel">
      {steps.map((s, i) => (
        <li key={s.label}>
          <span>{s.label}</span>
          <div className="adm-funnel-bar-wrap" aria-hidden="true"><div className="adm-funnel-bar" style={{ width: `${top ? Math.max(0.5, (s.value / top) * 100) : 0}%` }} /></div>
          <span className="adm-funnel-val">{num(s.value)}{i > 0 && <small>{pct(s.value, steps[i - 1].value)} da etapa anterior</small>}</span>
        </li>
      ))}
    </ol>
  );
}
