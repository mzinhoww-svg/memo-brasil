"use client";

import { useState } from "react";
import { Ico } from "@/revela/master-kit";
import { ExportSheet, type ExportSheetProps } from "@/revela/master/ExportSheet";
import { MAX_ROWS } from "@/lib/master/export-csv";

/** Botão "Exportar" do cabeçalho: abre a folha única (M24) com tela, período, filtros, formato e linhas estimadas. O arquivo sai com os filtros da tela
 *  e a exportação fica na auditoria (RPC `admin_export_csv`). Depois de exportar, uma linha mostra o nome do arquivo e as linhas. */
export function ExportSheetButton({ label = "Exportar", ...sheet }: Omit<ExportSheetProps, "onClose" | "inline"> & { label?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | undefined>();
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => { setMsg(undefined); setOpen(true); }} aria-haspopup="dialog"><Ico n="download" />{label}</button>
      {msg && <span className="rv-caption" role="status" style={{ alignSelf: "center" }}>{msg}</span>}
      {open && (
        <ExportSheet {...sheet} onClose={() => setOpen(false)}
          onDone={(r) => {
            sheet.onDone?.(r);
            const n = r.rows.toLocaleString("pt-BR");
            setMsg(r.truncated ? `${r.filename}: limitado às primeiras ${MAX_ROWS.toLocaleString("pt-BR")} linhas.` : `${r.filename} · ${n} ${r.rows === 1 ? "linha" : "linhas"}`);
          }} />
      )}
    </>
  );
}
