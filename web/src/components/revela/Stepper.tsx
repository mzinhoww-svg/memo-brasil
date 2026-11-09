"use client";

import { useId } from "react";

/** Contador com menos e mais. `format` aplica zero à esquerda (ex.: "08"). */
export function Stepper({ label, value, min = 1, max = 99, onChange, decrementLabel, incrementLabel, format = (n: number) => String(n).padStart(2, "0") }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void; decrementLabel: string; incrementLabel: string; format?: (n: number) => string }) {
  const id = useId();
  return (
    <div className="rvl-group" role="group" aria-labelledby={id}>
      <span id={id} className="rv-group-label">{label}</span>
      <div className="rv-stepper">
        <button type="button" className="rv-step-btn" aria-label={decrementLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <span className="rv-stepper-valor" aria-live="polite">{format(value)}</span>
        <button type="button" className="rv-step-btn" aria-label={incrementLabel} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}
