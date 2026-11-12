"use client";
import { useOdometer } from "@/lib/motion/use-moments";

/**
 * Número que rola (odômetro do kit). O texto de verdade fica em `<b>` só para leitor de tela e testes;
 * o visual são os dígitos do kit (sempre com `minDigits`; `padText` faz o texto acessível também ter zeros à esquerda). Com `value` nulo mostra `fallback` (por exemplo, "∞").
 */
export function Odo({ value, minDigits = 2, fallback = "∞", padText = false }: { value: number | null; minDigits?: number; fallback?: string; padText?: boolean }) {
  const ref = useOdometer<HTMLSpanElement>(value, minDigits);
  const text = value === null ? fallback : padText ? String(value).padStart(minDigits, "0") : String(value);
  return (
    <>
      <b className="rv-sr-only">{text}</b>
      {value === null ? <span className="rvm-odo" aria-hidden="true">{fallback}</span> : <span ref={ref} className="rvm-odo" aria-hidden="true" />}
    </>
  );
}
