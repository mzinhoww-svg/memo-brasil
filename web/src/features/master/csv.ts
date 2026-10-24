export interface CsvCol<R> { key: keyof R & string; label: string }

const PERIGOSO = /^[=+\-@\t\r]/;

function cell(v: unknown): string {
  if (v == null) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Injeção de fórmula: só texto; números reais (negativos) não são tocados.
  if (typeof v === "string" && PERIGOSO.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV para Excel pt-BR: separador `;`, BOM UTF-8, CRLF, aspas duplicadas, proteção contra fórmulas. */
export function toCsv<R extends object>(rows: readonly R[], cols: readonly CsvCol<R>[]): string {
  const head = cols.map((c) => cell(c.label)).join(";");
  const body = rows.map((r) => cols.map((c) => cell((r as Record<string, unknown>)[c.key])).join(";"));
  return "﻿" + [head, ...body].join("\r\n");
}
