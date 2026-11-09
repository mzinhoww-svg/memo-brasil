/** Capa do sistema (kit): laje de ação, campo de borda, discos e um único ponto REC. */
export function Cover({ className }: { className?: string }) {
  const dots: [number, number][] = [];
  for (let row = 0; row < 7; row++) for (let k = 0; k <= row; k++) dots.push([232 + 24 * k, 72 + 24 * row]);
  return (
    <svg className={className} viewBox="0 0 528 288" role="img" aria-label="Capa Revela" style={{ display: "block", width: "100%", height: "auto" }}>
      <rect x="16" y="-20" width="176" height="260" rx="20" style={{ fill: "var(--revela)" }} />
      <circle cx="104" cy="168" r="48" style={{ fill: "var(--bg)" }} />
      <rect x="208" y="48" width="320" height="192" rx="20" style={{ fill: "var(--line)" }} />
      <rect x="208" y="256" width="120" height="16" rx="8" style={{ fill: "var(--ink-muted)" }} />
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6" style={{ fill: "var(--revela)" }} />
      ))}
      <circle cx="448" cy="168" r="9" style={{ fill: "var(--danger)" }} />
    </svg>
  );
}
