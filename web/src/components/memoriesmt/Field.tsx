"use client";

import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & { label: string; error?: string; help?: string; code?: boolean };

/** Campo de 56px com rótulo sempre visível, ajuda e erro. Erro diz o que fazer. */
export function Field({ label, error, help, code, ...input }: Props) {
  const id = useId();
  const helpId = help ? `${id}-ajuda` : undefined;
  const errId = error ? `${id}-erro` : undefined;
  return (
    <div className="mm-field">
      <label className="mm-field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={cx("mm-field-input", code && "mm-field-input--codigo")}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errId, helpId].filter(Boolean).join(" ") || undefined}
        {...input}
      />
      {error && <span id={errId} className="mm-field-erro">{error}</span>}
      {help && <span id={helpId} className="mm-field-ajuda">{help}</span>}
    </div>
  );
}
