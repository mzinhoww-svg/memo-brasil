"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

export type Theme = "dia" | "noite";
export const THEME_KEY = "mm-tema";

/** Script inline: aplica o tema salvo antes da primeira pintura. Dia é o padrão do design system. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.setAttribute("data-theme",t==="noite"?"noite":"dia")}catch(e){document.documentElement.setAttribute("data-theme","dia")}`;

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeContext = createContext<Ctx | null>(null);

/** A fonte de verdade é o atributo data-theme do <html>; o React só assina as mudanças. */
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const snapshot = (): Theme => (document.documentElement.getAttribute("data-theme") === "noite" ? "noite" : "dia");

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "dia" as Theme);

  const setTheme = useCallback((t: Theme) => {
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
