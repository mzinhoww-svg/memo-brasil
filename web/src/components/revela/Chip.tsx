import type { ReactNode } from "react";
import { cx } from "./cx";

/** Pílula de 44px. Reação, filtro ou sugestão. O estado selecionado usa preenchimento, não só cor de borda. */
export function Chip({ variant = "reacao", pressed, count, onClick, children }: { variant?: "reacao" | "filtro" | "sugestao"; pressed?: boolean; count?: number; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx("rv-chip", variant === "filtro" && "rv-chip--filtro", variant === "sugestao" && "rv-chip--sugestao")} aria-pressed={pressed ?? false} onClick={onClick}>
      {children}
      {count !== undefined && count > 0 ? <>&nbsp;{count.toLocaleString("pt-BR")}</> : null}
    </button>
  );
}

export function Chips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="rv-chips" role="group" aria-label={label}>
      {children}
    </div>
  );
}
