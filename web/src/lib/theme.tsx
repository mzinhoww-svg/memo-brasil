"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dia" | "noite";
export const THEME_KEY = "mm-tema";

/** Script inline: aplica o tema salvo antes da primeira pintura. Dia é o padrão do design system. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.setAttribute("data-theme",t==="noite"?"noite":"dia")}catch(e){document.documentElement.setAttribute("data-theme","dia")}`;

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dia");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setThemeState(current === "noite" ? "noite" : "dia");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* armazenamento indisponível: o tema vale só nesta sessão */
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === "dia" ? "noite" : "dia"), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme fora do ThemeProvider");
  return ctx;
}
