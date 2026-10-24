export interface Delta { text: string; tone: "ok" | "crit" | "dim"; sign: "+" | "-" | "0" | "novo" }

/** Variação percentual contra o período anterior; `lowerIsBetter` inverte a leitura semântica (ex.: falhas). */
export function deltaOf(current: number, previous: number | null | undefined, lowerIsBetter = false): Delta | null {
  if (previous == null) return null;
  if (previous === 0) return current > 0 ? { text: "novo", tone: "dim", sign: "novo" } : { text: "0%", tone: "dim", sign: "0" };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return { text: "0%", tone: "dim", sign: "0" };
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  return { text: `${up ? "+" : "-"}${Math.abs(pct)}%`, tone: good ? "ok" : "crit", sign: up ? "+" : "-" };
}

export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null;
  const W = 96, H = 28, pad = 4;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i * (W - pad * 2)) / (values.length - 1), H - pad - ((v - min) / span) * (H - pad * 2)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg className="adm-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r={4} />
    </svg>
  );
}

export interface KpiProps {
  label: string;
  /** Valor já formatado (ex.: num(), brl()). */
  value: string;
  /** Valor numérico atual e do período anterior, para o delta. */
  current?: number;
  previous?: number | null;
  lowerIsBetter?: boolean;
  spark?: readonly number[];
  note?: string;
}

export function Kpi({ label, value, current, previous, lowerIsBetter, spark, note }: KpiProps) {
  const d = current != null ? deltaOf(current, previous, lowerIsBetter) : null;
  return (
    <section className="adm-kpi">
      <h2 className="adm-kpi-label">{label}</h2>
      <div className="adm-kpi-row">
        <span className="adm-kpi-value">{value}</span>
        {spark && <Sparkline values={spark} />}
      </div>
      {d && <span className="adm-kpi-delta" data-tone={d.tone} data-sign={d.sign}>{d.text}<span className="adm-sr"> em relação ao período anterior</span></span>}
      {note && <span className="adm-nota">{note}</span>}
    </section>
  );
}
