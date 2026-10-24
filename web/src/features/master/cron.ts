/** Cron de 5 campos em UTC. Só as formas comuns são interpretadas; o resto volta cru. */
type Field = { kind: "any" } | { kind: "step"; n: number } | { kind: "at"; n: number };

function field(s: string, max: number): Field | null {
  if (s === "*") return { kind: "any" };
  let m = /^\*\/(\d{1,2})$/.exec(s);
  if (m) { const n = Number(m[1]); return n >= 1 && n <= max ? { kind: "step", n } : null; }
  m = /^(\d{1,2})$/.exec(s);
  if (m) { const n = Number(m[1]); return n <= max ? { kind: "at", n } : null; }
  return null;
}
function parse(expr: string): { min: Field; hour: Field } | null {
  const p = expr.trim().split(/\s+/);
  if (p.length !== 5 || p[2] !== "*" || p[3] !== "*" || p[4] !== "*") return null;
  const min = field(p[0], 59), hour = field(p[1], 23);
  return min && hour ? { min, hour } : null;
}
const pad = (n: number) => String(n).padStart(2, "0");

export function humanCron(expr: string): string {
  const c = parse(expr);
  if (!c) return expr;
  const { min, hour } = c;
  if (hour.kind === "any") {
    if (min.kind === "any") return "a cada minuto";
    if (min.kind === "step") return min.n === 1 ? "a cada minuto" : `a cada ${min.n} min`;
    return min.n === 0 ? "de hora em hora" : `de hora em hora, no minuto ${min.n}`;
  }
  if (hour.kind === "at" && min.kind === "at") return `diariamente às ${pad(hour.n)}:${pad(min.n)} (UTC)`;
  if (hour.kind === "step" && min.kind === "at" && min.n === 0) return `a cada ${hour.n} h`;
  return expr;
}

const hit = (f: Field, v: number) => (f.kind === "any" ? true : f.kind === "step" ? v % f.n === 0 : v === f.n);

/** Próxima execução estritamente depois de `from` (UTC); null se a expressão não for interpretável. */
export function nextRun(expr: string, from: Date): Date | null {
  const c = parse(expr);
  if (!c) return null;
  const t = new Date(from.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  for (let i = 0; i <= 1440; i++) {
    if (hit(c.hour, t.getUTCHours()) && hit(c.min, t.getUTCMinutes())) return t;
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  return null;
}
