import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "crit" | "info" | "dim";

/** Etiqueta de estado: cor semântica + texto (nunca só cor). */
export function Pill({ tone = "dim", children }: { tone?: Tone; children: ReactNode }) {
  return <span className="adm-pill" data-tone={tone}>{children}</span>;
}
