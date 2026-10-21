import type { CSSProperties, ReactNode } from "react";
import type { EventFontId, PaletteId } from "@/domain/event";
import { EVENT_FONT_VAR } from "@/lib/event-theme";

/** Veste os filhos com a identidade do evento: 5 cores e uma fonte (só para o nome do evento). */
export function EventTheme({ palette, font, children, className }: { palette: PaletteId; font: EventFontId; children: ReactNode; className?: string }) {
  return (
    <div data-palette={palette} className={className} style={{ "--font-evento": `var(${EVENT_FONT_VAR[font]}), cursive` } as CSSProperties}>
      {children}
    </div>
  );
}
