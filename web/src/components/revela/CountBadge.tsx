/** Contador de pendências. Zero não aparece. Usar junto do rótulo, nunca sozinho. */
export function CountBadge({ count, noun = "pendentes" }: { count: number; noun?: string }) {
  if (count <= 0) return null;
  return <span className="rv-count" aria-label={`${count} ${noun}`}>{count > 99 ? "99+" : count}</span>;
}
