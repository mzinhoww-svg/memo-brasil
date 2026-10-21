"use client";

import { useTheme } from "@/lib/theme";

/** Alterna Dia e Noite. Usa o botão pequeno do kit; o estado é anunciado no rótulo. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="mm-btn mm-btn--pequeno mm-btn--secundario" onClick={toggle} aria-label={theme === "dia" ? "Mudar para o tema Noite" : "Mudar para o tema Dia"}>
      {theme === "dia" ? "Noite" : "Dia"}
    </button>
  );
}
