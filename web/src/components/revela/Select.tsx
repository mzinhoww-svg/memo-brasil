"use client";

import { useId, type SelectHTMLAttributes } from "react";

/** Seleção com o visual do Field do kit (56px, borda 1,5px em tinta). Use para mais de seis opções (README do OptionGroup). */
export function Select({ label, options, help, ...select }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> & { label: string; options: { value: string; label: string }[]; help?: string }) {
  const id = useId();
  return (
    <div className="rvl-field">
      <label className="rv-field-label" htmlFor={id}>{label}</label>
      <select id={id} className="rv-field-input" aria-describedby={help ? `${id}-ajuda` : undefined} {...select}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {help && <span id={`${id}-ajuda`} className="rv-field-ajuda">{help}</span>}
    </div>
  );
}
