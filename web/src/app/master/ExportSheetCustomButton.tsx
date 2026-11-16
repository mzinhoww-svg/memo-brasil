"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/revela/master-kit";
import { ExportSheet } from "@/revela/master/ExportSheet";
import { exportCsv, type ExportFilters, type ExportKind } from "@/lib/master/export-csv";
import { exportCustom, type CustomExport } from "@/lib/master/export-custom";

/** Botão "Exportar" do cabeçalho: abre a folha única (M24) com tela, período, filtros, formato e linhas estimadas. A exportação entra na auditoria (servidor).
 *  `kind` das listas que já têm tipo em `admin_export_csv`; "auditoria" e "moderacao" usam a RPC própria (filtros por categoria, evento e aba). */
export function ExportSheetCustomButton({ kind = "auditoria", screen, screenLabel, filters, filtersText, period = "Todo o período", rowsEstimate, custom }: {
  kind?: ExportKind; screen: string; screenLabel: string; filters: ExportFilters; filtersText: string; period?: string; rowsEstimate: number | null; custom?: CustomExport;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setOpen(true)}><Ico n="download" />Exportar</button>
      {open && (
        <ExportSheet kind={kind} filters={filters} screen={screen} screenLabel={screenLabel} period={period} filtersText={filtersText} rowsEstimate={rowsEstimate}
          run={custom ? (_k, f, s, at) => exportCustom(custom, f, s, at) : exportCsv} onDone={() => router.refresh()} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
