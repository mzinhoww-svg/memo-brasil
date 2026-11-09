import type { ReactNode } from "react";
import { wrapOf, type CameraStyle } from "@/domain/options";

/**
 * Veste os filhos com a embalagem da câmera do evento (`data-wrap`). A identidade do evento é a embalagem
 * (festa, casamento, aniversario, noite); as cores continuam as do tema Noite, sem paleta nem fonte por evento.
 */
export function EventTheme({ wrap, children, className }: { wrap?: CameraStyle | null; children: ReactNode; className?: string }) {
  return (
    <div data-wrap={wrapOf(wrap)} className={className}>
      {children}
    </div>
  );
}
