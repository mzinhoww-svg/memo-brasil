/** Estado de carregamento visível (UXA-111): blocos cinza com pulso leve; o texto fica só para leitor de tela. */
export function Skeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="rv-skeleton-wrap">
      <span className="rv-sr-only">{label}</span>
      <span className="rv-skeleton rv-skeleton--titulo" aria-hidden="true" />
      {Array.from({ length: lines }, (_, i) => <span key={i} className="rv-skeleton" aria-hidden="true" />)}
    </div>
  );
}
