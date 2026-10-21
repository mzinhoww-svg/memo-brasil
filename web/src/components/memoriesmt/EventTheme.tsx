import type { CSSProperties, ReactNode } from "react";
import type { EventFontId, PaletteId } from "@/domain/event";
import type { ThemeSpec } from "@/domain/theme";
import { EVENT_FONT_VAR } from "@/lib/event-theme";
import { themeStyle, validateTheme } from "@/lib/event-theme/spec";

/**
 * Veste os filhos com a identidade do evento: 5 cores e uma fonte (só para o nome do evento).
 * Camada Event Theme: as variáveis vivem só neste wrapper (nunca em :root), então um evento não afeta a marca MemoriesMT nem outros eventos.
 * `theme` personalizado só vale se passar na validação (contraste, formato); senão cai na paleta do evento.
 */
export function EventTheme({ palette, font, theme, children, className }: { palette: PaletteId; font: EventFontId; theme?: ThemeSpec; children: ReactNode; className?: string }) {
  const custom = theme && validateTheme(theme).ok ? (themeStyle(theme, "dia") as CSSProperties) : undefined;
  return (
    <div data-event-theme={custom ? "custom" : "palette"} data-palette={palette} className={className} style={{ "--font-evento": `var(${EVENT_FONT_VAR[font]}), cursive`, ...custom } as CSSProperties}>
      {children}
    </div>
  );
}
