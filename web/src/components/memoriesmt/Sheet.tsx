"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Folha modal: foco entra ao abrir e volta ao fechar; Esc e toque fora fecham; Tab fica dentro. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="app-dialog" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="app-dialog-panel" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="app-sheet-handle" aria-hidden="true" />
        <h2 id={id} className="titulo-card app-h1">{title}</h2>
        {children}
      </div>
    </div>
  );
}
