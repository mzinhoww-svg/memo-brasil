/** Estado de carregamento visível (UXA-111): blocos cinza com pulso leve; o texto fica só para leitor de tela. */
export function Skeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="mm-skeleton-wrap">
      <span className="mm-sr-only">{label}</span>
      <span className="mm-skeleton mm-skeleton--titulo" aria-hidden="true" />
      {Array.from({ length: lines }, (_, i) => <span key={i} className="mm-skeleton" aria-hidden="true" />)}
    </div>
  );
}
