import { num, pct } from "@/features/master/format";

/** Medidor de uso (ex.: capacidade). Tom automático: >= 80% aviso, >= 95% crítico, salvo `tone`. */
export function Meter({ label, value, max, tone, valueText }: { label: string; value: number; max: number; tone?: "ok" | "warn" | "crit"; valueText?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const t = tone ?? (ratio >= 0.95 ? "crit" : ratio >= 0.8 ? "warn" : "ok");
  return (
    <div className="adm-meter" data-tone={t}>
      <div className="adm-meter-head"><span>{label}</span><span>{valueText ?? `${num(value)} / ${num(max)} (${pct(value, max)})`}</span></div>
      <div className="adm-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
        <div className="adm-meter-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
