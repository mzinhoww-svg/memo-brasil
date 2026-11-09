"use client";

import { useId } from "react";
import { cx } from "./cx";

export interface Option<T extends string | number | boolean | null> {
  value: T;
  label: string;
}

/** Opções exclusivas de 48px. Mais de seis opções: use um campo de seleção. */
export function OptionGroup<T extends string | number | boolean | null>({ label, options, value, onChange, list }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void; list?: boolean }) {
  const id = useId();
  return (
    <div className="rv-group" role="group" aria-labelledby={id}>
      <span id={id} className="rv-group-label">{label}</span>
      <div className={cx("rv-opts", list && "rv-opts--lista")}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="rv-opt" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
