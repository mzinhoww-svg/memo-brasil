import { RowsSkeleton } from "./ScreenSkeleton";

/**
 * Esqueleto do corpo de uma tela dentro do `PainelFrame` (o cabeçalho e as abas já estão na tela).
 * Sem "use client": serve nos `loading.tsx` do servidor e no quadro de carregamento do shell.
 */
export function PainelBodySkeleton({ label = "Abrindo o painel…", variant = "lista" }: { label?: string; variant?: "lista" | "grade" }) {
  if (variant === "grade") {
    return (
      <div className="pf-pad" aria-busy="true">
        <span role="status" className="rv-sr-only">{label}</span>
        <div className="cont-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className="rv-skeleton cont-tile-skel" />)}
        </div>
      </div>
    );
  }
  return <div className="pf-pad"><RowsSkeleton label={label} rows={6} /></div>;
}
