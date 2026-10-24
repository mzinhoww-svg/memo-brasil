import { num } from "@/features/master/format";

export interface StackSegment { label: string; value: number; /** cor opcional (var CSS); padrão: série pela ordem. */ color?: string }

const SERIES = ["var(--adm-s1)", "var(--adm-s2)", "var(--adm-s3)", "var(--adm-s4)", "var(--adm-s5)"];

/** Barra empilhada com vão de 2 px e legenda com valores (identidade nunca só por cor). */
export function StackBar({ segments, format = num, label }: { segments: readonly StackSegment[]; format?: (n: number) => string; label?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const col = (s: StackSegment, i: number) => s.color ?? SERIES[i % SERIES.length];
  return (
    <div>
      <div className="adm-stack" role="img" aria-label={label ?? segments.map((s) => `${s.label}: ${format(s.value)}`).join("; ")}>
        {segments.filter((s) => s.value > 0).map((s) => {
          const i = segments.indexOf(s);
          return <span key={s.label} style={{ flexGrow: s.value, flexBasis: 0, ["--c" as string]: col(s, i) }} title={`${s.label}: ${format(s.value)}`} />;
        })}
        {total === 0 && <span style={{ flexGrow: 1, ["--c" as string]: "var(--adm-linha)" }} />}
      </div>
      <ul className="adm-legend" style={{ marginTop: 8 }}>
        {segments.map((s, i) => <li key={s.label}><span className="adm-swatch" style={{ ["--c" as string]: col(s, i) }} />{s.label}: {format(s.value)}</li>)}
      </ul>
    </div>
  );
}
