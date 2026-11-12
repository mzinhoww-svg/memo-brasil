"use client";

import { useState } from "react";
import { filtersText, ABAS, type PessoasAba } from "@/lib/master/people";
import { ExportSheet } from "@/revela/master";
import { Ico } from "@/revela/master-kit";

/** Botão "Exportar" das abas de Pessoas: abre a folha única (M24), que baixa o CSV com os filtros da aba. O servidor grava a auditoria. */
export function PessoasExport({ aba, f, q, rows }: { aba: PessoasAba; f?: string; q?: string; rows: number }) {
  const [open, setOpen] = useState(false);
  const label = ABAS.find((a) => a.id === aba)?.label ?? "";
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => setOpen(true)}><Ico n="download" />Exportar</button>
      {open && (
        <ExportSheet kind="pessoas" filters={{ aba, f, q }} screen={`pessoas-${aba}`} screenLabel={`Pessoas · ${label}`} period="Todo o período"
          filtersText={filtersText(aba, f, q)} rowsEstimate={rows} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
