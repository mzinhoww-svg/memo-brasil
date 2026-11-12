/** Exportação CSV do Master: o servidor monta o arquivo (RPC `admin_export_csv`, que também registra a auditoria); aqui só se pede e se baixa. */
import { browserSupabase } from "@/lib/supabase/client";

export type ExportKind = "visao" | "eventos" | "pagamentos" | "pessoas" | "auditoria" | "impressoes";
export type ExportFilters = Record<string, string | number | undefined | null>;
export interface ExportResult { csv: string; rows: number; truncated: boolean }

/** Excel só reconhece UTF-8 (acentos) com a marca de ordem de bytes. */
export const BOM = "﻿";
export const MAX_ROWS = 50_000;

const pad = (n: number) => String(n).padStart(2, "0");
/** `revela-<tela>-<AAAAMMDD-HHMM>.csv` na hora de Cuiabá (a mesma das telas do Master). */
export function exportFilename(screen: string, at: Date = new Date()): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at)) p[x.type] = x.value;
  return `revela-${screen.replace(/[^a-z0-9-]/gi, "").toLowerCase()}-${p.year}${p.month}${p.day}-${pad(Number(p.hour))}${p.minute}.csv`;
}

export function csvBlob(csv: string): Blob {
  return new Blob([BOM, csv], { type: "text/csv;charset=utf-8" });
}

/** Só os filtros com valor, para a RPC (e para a auditoria). */
export function cleanFilters(f: ExportFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && v !== "") out[k] = v;
  return out;
}

export class ExportError extends Error {
  constructor(readonly code: "forbidden" | "ratelimited" | "invalid" | "unavailable") {
    super(code);
    this.name = "ExportError";
  }
}
const CODES: Record<string, ExportError["code"]> = { MM004: "forbidden", MM006: "ratelimited", MM005: "invalid" };

export function exportErrorText(e: unknown): string {
  const c = e instanceof ExportError ? e.code : "unavailable";
  return c === "forbidden" ? "Sem permissão para exportar esta tela."
    : c === "ratelimited" ? "Muitas exportações seguidas. Espere alguns minutos."
    : c === "invalid" ? "Os filtros desta tela não puderam ser exportados."
    : "Não foi possível exportar agora. Tente de novo.";
}

export async function requestExport(kind: ExportKind, filters: ExportFilters): Promise<ExportResult> {
  const args = {p_kind:kind,p_filters:cleanFilters(filters),...(kind === "pessoas" && filters.aba === "equipe" ? {p_design_version:2} : {})};
  const r = await browserSupabase().rpc("admin_export_csv", args);
  if (r.error) throw new ExportError(CODES[r.error.code ?? ""] ?? "unavailable");
  const d = r.data as { csv?: unknown; rows?: unknown; truncated?: unknown } | null;
  if (!d || typeof d.csv !== "string") throw new ExportError("unavailable");
  return { csv: d.csv, rows: Number(d.rows ?? 0), truncated: d.truncated === true };
}

/** Baixa pelo navegador (Blob + link temporário). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pede, monta o arquivo e baixa. Devolve o resumo para a tela avisar (linhas, corte no teto). */
export async function exportCsv(kind: ExportKind, filters: ExportFilters, screen: string, at: Date = new Date()): Promise<ExportResult & { filename: string }> {
  const res = await requestExport(kind, filters);
  const filename = exportFilename(screen, at);
  saveBlob(csvBlob(res.csv), filename);
  return { ...res, filename };
}
