/**
 * Gráficos locais da frente Plataforma (Analytics e Storage). SVG sem JS, eixo único, tooltip nativo (<title>)
 * com área de toque maior que a marca, legenda a partir de 2 séries e tabela oculta com os mesmos dados.
 * Cores: séries do kit (--adm-s1..s5). Não estão no kit para não editar `kit/`.
 */
import styles from "./charts.module.css";

const W = 640, H = 200, L = 44, R = 12, T = 10, B = 24;

export function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const x = v / p;
  return (x <= 1 ? 1 : x <= 2 ? 2 : x <= 4 ? 4 : x <= 5 ? 5 : 10) * p;
}

type Fmt = (n: number) => string;
const plain: Fmt = (n) => new Intl.NumberFormat("pt-BR").format(n);

function Axis({ max, fmt, y }: { max: number; fmt: Fmt; y: (v: number) => number }) {
  return (
    <>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="grade" x1={L} x2={W - R} y1={y(f * max)} y2={y(f * max)} />
          <text x={L - 6} y={y(f * max) + 4} textAnchor="end">{fmt(f * max)}</text>
        </g>
      ))}
    </>
  );
}

function SrTable({ caption, labels, series, fmt }: { caption: string; labels: readonly string[]; series: { name: string; values: readonly number[] }[]; fmt: Fmt }) {
  return (
    <table className="adm-sr">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Dia</th>{series.map((s) => <th key={s.name} scope="col">{s.name}</th>)}</tr></thead>
      <tbody>{labels.map((l, i) => <tr key={i}><th scope="row">{l}</th>{series.map((s) => <td key={s.name}>{fmt(s.values[i] ?? 0)}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** Barras de uma série por dia. */
export function Bars({ title, labels, values, name, fmt = plain, note }: { title: string; labels: readonly string[]; values: readonly number[]; name: string; fmt?: Fmt; note?: string }) {
  const nPts = values.length;
  const max = niceMax(Math.max(0, ...values));
  const iw = W - L - R, ih = H - T - B;
  const band = nPts ? iw / nPts : iw;
  const bw = Math.max(2, Math.min(16, band - 2));
  const y = (v: number) => T + ih - (v / max) * ih;
  const step = Math.max(1, Math.ceil(nPts / 6));
  const bar = (x: number, v: number) => {
    const h = Math.max(0, T + ih - y(v)), r = Math.min(4, h, bw / 2);
    return h <= 0 ? "" : `M${x},${T + ih}V${y(v) + r}Q${x},${y(v)} ${x + r},${y(v)}H${x + bw - r}Q${x + bw},${y(v)} ${x + bw},${y(v) + r}V${T + ih}Z`;
  };
  return (
    <figure className="adm-chart">
      <figcaption>{title}</figcaption>
      {note && <p className={styles.note}>{note}</p>}
      {nPts === 0 ? <p className="adm-nota">Sem dados no período.</p> : (
        <div role="img" aria-label={`${title}: ${name}, de ${labels[0]} a ${labels[nPts - 1]}. Máximo ${fmt(Math.max(...values))}.`}>
          <svg className={`adm-svg ${styles.svg}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
            <Axis max={max} fmt={fmt} y={y} />
            {values.map((v, i) => {
              const x = L + band * i + (band - bw) / 2;
              return (
                <g key={i}>
                  <rect className={styles.hit} x={L + band * i} y={T} width={band} height={ih}><title>{`${labels[i]} · ${name}: ${fmt(v)}`}</title></rect>
                  <path className="s1" d={bar(x, v)} />
                  {i % step === 0 && <text x={L + band * i + band / 2} y={H - 6} textAnchor="middle">{labels[i]}</text>}
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <SrTable caption={title} labels={labels} series={[{ name, values }]} fmt={fmt} />
    </figure>
  );
}

export interface LineSeries { name: string; values: readonly number[]; /** índice da cor da série (1..5). */ color: 1 | 2 | 3 | 4 | 5; dashed?: boolean }

/** Linhas (1 a 3 séries) no mesmo eixo; a primeira série recebe o rótulo direto no último ponto. */
export function Lines({ title, labels, series, fmt = plain, note }: { title: string; labels: readonly string[]; series: readonly LineSeries[]; fmt?: Fmt; note?: string }) {
  const nPts = labels.length;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (nPts <= 1 ? iw / 2 : (i * iw) / (nPts - 1));
  const y = (v: number) => T + ih - (v / max) * ih;
  const step = Math.max(1, Math.ceil(nPts / 6));
  const band = nPts > 1 ? iw / (nPts - 1) : iw;
  return (
    <figure className="adm-chart">
      <figcaption>{title}</figcaption>
      {note && <p className={styles.note}>{note}</p>}
      {series.length > 1 && (
        <ul className="adm-legend">
          {series.map((s) => <li key={s.name}><span className={s.dashed ? `adm-swatch ${styles.dashSwatch}` : "adm-swatch"} style={{ ["--c" as string]: `var(--adm-s${s.color})` }} />{s.name}: {fmt(s.values[s.values.length - 1] ?? 0)}</li>)}
        </ul>
      )}
      {nPts === 0 ? <p className="adm-nota">Sem dados no período.</p> : (
        <div role="img" aria-label={`${title}: ${series.map((s) => `${s.name} termina em ${fmt(s.values[s.values.length - 1] ?? 0)}`).join("; ")}.`}>
          <svg className={`adm-svg ${styles.svg}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
            <Axis max={max} fmt={fmt} y={y} />
            {labels.map((l, i) => i % step === 0 && <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text>)}
            {series.map((s) => (
              <polyline key={s.name} className={styles.line} style={{ ["--c" as string]: `var(--adm-s${s.color})` }} strokeDasharray={s.dashed ? "6 4" : undefined}
                points={s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
            ))}
            {series[0] && series[0].values.length > 0 && (
              <circle className={styles.dot} style={{ ["--c" as string]: `var(--adm-s${series[0].color})` }} cx={x(series[0].values.length - 1)} cy={y(series[0].values[series[0].values.length - 1])} r={4} />
            )}
            {labels.map((l, i) => (
              <rect key={`h${i}`} className={styles.hit} x={x(i) - band / 2} y={T} width={band} height={ih}>
                <title>{`${l} · ${series.map((s) => `${s.name}: ${fmt(s.values[i] ?? 0)}`).join(" · ")}`}</title>
              </rect>
            ))}
          </svg>
        </div>
      )}
      <SrTable caption={title} labels={labels} series={series.map((s) => ({ name: s.name, values: s.values }))} fmt={fmt} />
    </figure>
  );
}
