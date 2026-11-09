"use client";

import { useRef, type KeyboardEvent } from "react";
import { CountBadge } from "./CountBadge";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/** Abas de 44px do admin. Setas movem o foco. Painel controlado pelo consumidor (`panelId(id)`). */
export const tabId = (base: string, id: string) => `${base}-tab-${id}`;
export const panelId = (base: string, id: string) => `${base}-painel-${id}`;

export function Tabs({ base, label, tabs, value, onChange }: { base: string; label: string; tabs: TabDef[]; value: string; onChange: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  function onKey(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === value);
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }
  return (
    <div ref={ref} className="rv-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button key={t.id} id={tabId(base, t.id)} type="button" role="tab" className="rvl-tab" aria-selected={t.id === value} aria-controls={panelId(base, t.id)} tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count ? <> · {t.count.toLocaleString("pt-BR")}</> : null}
        </button>
      ))}
    </div>
  );
}
export { CountBadge };
