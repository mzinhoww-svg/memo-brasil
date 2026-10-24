export interface BarLinePoint { label: string; a: number; b: number; line: number }
export interface BarLineChartProps {
  title: string;
  data: readonly BarLinePoint[];
  /** Nomes das três séries: barra a, barra b e linha. Mesma escala (eixo único). */
  names: { a: string; b: string; line: string };
  /** Texto de resumo para leitores de tela (padrão: título + intervalo). */
  summary?: string;
}

const W = 640, H = 220, L = 36, R = 8, T = 8, B = 24;

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * p;
}

/** Barras (duas séries) + linha (terceira) em SVG; sem JS. Tabela oculta com os mesmos dados. */
export function BarLineChart({ title, data, names, summary }: BarLineChartProps) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.a, d.b, d.line])));
  const n = data.length;
  const iw = W - L - R, ih = H - T - B;
  const band = n ? iw / n : iw;
  const barW = Math.min(12, Math.max(2, band / 2 - 2));
  const y = (v: number) => T + ih - (v / max) * ih;
  const cx = (i: number) => L + band * i + band / 2;
  const step = Math.max(1, Math.ceil(n / 6));
  const bar = (x: number, v: number) => {
    const h = Math.max(0, T + ih - y(v)), r = Math.min(4, h, barW / 2);
    return h <= 0 ? "" : `M${x},${T + ih}V${y(v) + r}Q${x},${y(v)} ${x + r},${y(v)}H${x + barW - r}Q${x + barW},${y(v)} ${x + barW},${y(v) + r}V${T + ih}Z`;
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const aria = summary ?? `${title}: ${names.a}, ${names.b} e ${names.line}${n ? `, de ${data[0].label} a ${data[n - 1].label}` : ""}.`;
  const last = n ? data[n - 1] : null;
  return (
    <figure className="adm-chart">
      <figcaption>{title}</figcaption>
      <ul className="adm-legend">
        <li><span className="adm-swatch" style={{ ["--c" as string]: "var(--adm-s1)" }} />{names.a}</li>
        <li><span className="adm-swatch" style={{ ["--c" as string]: "var(--adm-s2)" }} />{names.b}</li>
        <li><span className="adm-swatch" style={{ ["--c" as string]: "var(--adm-s3)" }} />{names.line}</li>
      </ul>
      {n === 0 ? <p className="adm-nota">Sem dados no período.</p> : (
        <div role="img" aria-label={aria}>
          <svg className="adm-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
            {ticks.map((t) => (
              <g key={t}>
                <line className="grade" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
                <text x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
              </g>
            ))}
            {data.map((d, i) => (
              <g key={d.label + i}>
                <path className="s1" d={bar(cx(i) - barW - 1, d.a)}><title>{`${d.label} · ${names.a}: ${d.a}`}</title></path>
                <path className="s2" d={bar(cx(i) + 1, d.b)}><title>{`${d.label} · ${names.b}: ${d.b}`}</title></path>
                {i % step === 0 && <text x={cx(i)} y={H - 6} textAnchor="middle">{d.label}</text>}
              </g>
            ))}
            <polyline className="linha" points={data.map((d, i) => `${cx(i).toFixed(1)},${y(d.line).toFixed(1)}`).join(" ")} />
            {last && <circle className="ponto" cx={cx(n - 1)} cy={y(last.line)} r={4} />}
          </svg>
        </div>
      )}
      <table className="adm-sr">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Dia</th><th scope="col">{names.a}</th><th scope="col">{names.b}</th><th scope="col">{names.line}</th></tr></thead>
        <tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{d.a}</td><td>{d.b}</td><td>{d.line}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
