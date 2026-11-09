"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Linha com interruptor (role=switch), alvo de toque de 56px. */
export function ToggleRow({ label, hint, checked, onChange, icon, disabled, id }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; icon?: IconName; disabled?: boolean; id?: string }) {
  return (
    <button type="button" id={id} role="switch" aria-checked={checked} disabled={disabled} className="rv-row" onClick={() => onChange(!checked)} style={{ width: "100%", minHeight: 56, padding: "0 var(--space-4)", border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer", gap: "var(--space-3)", justifyContent: "flex-start" }}>
      {icon && <Icon name={icon} decorative size={20} />}
      <span style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 0" }}>
        <span>{label}</span>
        {hint && <span className="rv-caption">{hint}</span>}
      </span>
      <span className={`rv-toggle ${checked ? "rv-toggle--on" : ""}`} aria-hidden="true" />
    </button>
  );
}
