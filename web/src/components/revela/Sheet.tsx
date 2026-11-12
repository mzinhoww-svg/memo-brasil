"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useOpen } from "@/lib/motion/use-motion";

const focusables = (panel: HTMLElement) => Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));

/** Folha modal: foco entra ao abrir e volta ao fechar; Esc e toque fora fecham; Tab fica dentro. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const open = useOpen();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    (focusables(panel)[0] ?? panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const f = focusables(panel);
      if (!f.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      if (!f.some((el) => el === document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
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
  }, []); // onClose vem por ref: re-render do pai não devolve o foco ao gatilho
  useEffect(() => {
    const panel = ref.current;
    if (panel && !focusables(panel).length) panel.focus();
  });
  return (
    <div className="app-dialog rv-backdrop" data-open={open} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="app-dialog-panel rv-sheet-motion" data-open={open} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="app-sheet-handle" aria-hidden="true" />
        <h2 id={id} className="titulo-card app-h1">{title}</h2>
        {children}
      </div>
    </div>
  );
}
