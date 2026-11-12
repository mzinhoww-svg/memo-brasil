"use client";

import { useState } from "react";
import { ExportSheet } from "@/revela/master/ExportSheet";
import { Ico } from "@/revela/master-kit";

/** "Exportar" da lista de Impressões: abre a folha M24 com os filtros da tela; o servidor monta o CSV e registra a auditoria (só master). */
export function PrintExport({ status, q, filtersText, rowsEstimate }: { status: string; q: string; filtersText: string; rowsEstimate: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setOpen(true)}><Ico n="download" />Exportar</button>
      {open && (
        <ExportSheet kind="impressoes" filters={{ status, q }} screen="impressoes" screenLabel="Impressões" period="Todo o período" filtersText={filtersText} rowsEstimate={rowsEstimate} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
