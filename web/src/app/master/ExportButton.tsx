"use client";

import { useState } from "react";
import { Ico } from "@/revela/master-kit";
import { exportCsv, exportErrorText, MAX_ROWS, type ExportFilters, type ExportKind } from "@/lib/master/export-csv";

/** Botão "Exportar" do cabeçalho do Master (markup do desenho). Baixa o CSV dos mesmos filtros da tela; o servidor registra quem exportou. */
export function ExportButton({ kind, screen, filters = {}, label = "Exportar" }: { kind: ExportKind; screen: string; filters?: ExportFilters; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | undefined>();
  async function run() {
    setBusy(true);
    setMsg(undefined);
    try {
      const r = await exportCsv(kind, filters, screen);
      const n = r.rows.toLocaleString("pt-BR");
      setMsg({ text: r.truncated ? `${r.filename}: limitado às primeiras ${MAX_ROWS.toLocaleString("pt-BR")} linhas. Afine os filtros para ver o resto.` : `${r.filename} · ${n} ${r.rows === 1 ? "linha" : "linhas"}`, bad: false });
    } catch (e) {
      setMsg({ text: exportErrorText(e), bad: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => void run()} disabled={busy} aria-busy={busy}><Ico n="download" />{label}</button>
      {msg && <span className="rv-caption" role={msg.bad ? "alert" : "status"} style={{ alignSelf: "center" }}>{msg.text}</span>}
    </>
  );
}
