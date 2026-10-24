"use client";
import { toCsv, type CsvCol } from "@/features/master/csv";

/** Baixa as linhas recebidas (já filtradas no servidor) como CSV `;` com BOM. Nada sai do navegador. */
export function CsvButton<R extends object>({ filename, rows, cols, label = "Exportar CSV" }: { filename: string; rows: readonly R[]; cols: readonly CsvCol<R>[]; label?: string }) {
  const baixar = () => {
    const blob = new Blob([toCsv(rows, cols)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <button type="button" className="adm-btn" onClick={baixar} disabled={rows.length === 0}>{label}</button>;
}
