"use client";
/* Folha "Exportar" (M24 e M24-t): Master-exportar--folha.html e Master-exportar--folha-truncado.html. Uma só para todas as listas do Master.
   O servidor monta o CSV com os mesmos filtros da tela e grava a auditoria (RPC `admin_export_csv`, cliente `lib/master/export-csv.ts`). */
import { useCallback, useState } from "react";
import { exportCsv, exportErrorText, MAX_ROWS, type ExportFilters, type ExportKind, type ExportResult } from "@/lib/master/export-csv";
import { Ico } from "../master-kit";
import { ErrLine } from "./ActionSheet";
import { MasterModal, ModalButtons } from "./MasterModal";

export const EXPORT_FORMAT = "CSV (UTF-8, separador ,)";
const nf = new Intl.NumberFormat("pt-BR");

export interface UseExportArgs {
  kind: ExportKind;
  /** Filtros da tela, no formato que a RPC aceita (dias, f, q, aba, a, status). */
  filters: ExportFilters;
  /** Nome curto da tela para o arquivo (`revela-<tela>-<AAAAMMDD-HHMM>.csv`). */
  screen: string;
  onDone?: (r: ExportResult & { filename: string }) => void;
  /** Troca a exportação (testes). */
  run?: typeof exportCsv;
}

/** Handler da folha: pede o CSV, baixa e devolve o resumo; o erro volta em português para a linha vermelha. */
export function useExport({ kind, filters, screen, onDone, run = exportCsv }: UseExportArgs) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await run(kind, filters, screen);
      onDone?.(r);
      return r;
    } catch (e) {
      setError(exportErrorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [kind, filters, screen, onDone, run]);
  return { busy, error, start };
}

export interface ExportSheetProps extends UseExportArgs {
  /** "Tela": nome da tela como a pessoa a vê ("Pagamentos"). */
  screenLabel: string;
  /** "Período": texto pronto ("01 nov 2026 a 11 nov 2026"). */
  period: string;
  /** "Filtros": texto pronto ("Método: Pix · Situação: todas"). */
  filtersText: string;
  /** "Linhas estimadas": o total que a tela já conhece (null = desconhecido). */
  rowsEstimate: number | null;
  format?: string;
  onClose: () => void;
  inline?: boolean;
}

export function ExportSheet({ screenLabel, period, filtersText, rowsEstimate, format = EXPORT_FORMAT, onClose, inline, ...args }: ExportSheetProps) {
  const { busy, error, start } = useExport({ ...args, onDone: (r) => { args.onDone?.(r); onClose(); } });
  const truncated = rowsEstimate !== null && rowsEstimate > MAX_ROWS;
  return (
    <MasterModal label="Exportar" inline={inline} onClose={busy ? undefined : onClose}>
      <h2 className="rv-title">Exportar</h2>
      <p className="rv-caption" style={{ marginTop: "6px" }}>O arquivo sai com os filtros que estão aplicados na tela.</p>
      <div className="kv">
        <div><span>Tela</span><b>{screenLabel}</b></div>
        <div><span>Período</span><b>{period}</b></div>
        <div><span>Filtros</span><b>{filtersText}</b></div>
        <div><span>Formato</span><b>{format}</b></div>
        <div><span>Linhas estimadas</span><b>{rowsEstimate === null ? "—" : nf.format(rowsEstimate)}</b></div>
      </div>
      {truncated && <p className="errline"><Ico n="warn" />Passa de 50 mil linhas. O arquivo virá truncado nas primeiras {nf.format(MAX_ROWS)}. Reduza o período para exportar tudo.</p>}
      <div className="mnote" style={{ margin: "16px 0 0" }}>
        <Ico n="history" />
        <span>A exportação fica registrada na auditoria: quem, quando, tela e filtros.</span>
      </div>
      {error && <ErrLine>{error}</ErrLine>}
      <ModalButtons>
        <button type="button" className="rv-btn rv-btn--block" style={{ flex: 1 }} onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" style={{ flex: 1 }} disabled={busy} aria-busy={busy || undefined} onClick={() => void start()}>
          {busy ? "Exportando…" : truncated ? `Exportar ${nf.format(MAX_ROWS)} linhas` : "Exportar CSV"}
        </button>
      </ModalButtons>
    </MasterModal>
  );
}
