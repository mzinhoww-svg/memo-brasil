/** Exportações que têm RPC própria (a auditoria filtrada por categoria e evento, e a moderação): mesmo contrato de `exportCsv`
 *  (baixa o arquivo, o servidor grava a auditoria `export.csv`). */
import { browserSupabase } from "@/lib/supabase/client";
import { csvBlob, exportFilename, ExportError, saveBlob, type ExportFilters, type ExportResult } from "./export-csv";

export type CustomExport = "auditoria" | "moderacao";
const CODES: Record<string, ExportError["code"]> = { MM004: "forbidden", MM006: "ratelimited", MM005: "invalid" };

export function exportRpcArgs(which: CustomExport, f: ExportFilters): { fn: string; args: Record<string, unknown> } {
  if (which === "auditoria") return { fn: "admin_export_audit_csv", args: { p_category: f.categoria && f.categoria !== "todas" ? f.categoria : null, p_event: f.evento || null } };
  return { fn: "admin_export_moderation_csv", args: { p_aba: f.aba || "fotos" } };
}

export async function exportCustom(which: CustomExport, filters: ExportFilters, screen: string, at: Date = new Date()): Promise<ExportResult & { filename: string }> {
  const { fn, args } = exportRpcArgs(which, filters);
  const r = await browserSupabase().rpc(fn, args);
  if (r.error) throw new ExportError(CODES[r.error.code ?? ""] ?? "unavailable");
  const d = r.data as { csv?: unknown; rows?: unknown; truncated?: unknown } | null;
  if (!d || typeof d.csv !== "string") throw new ExportError("unavailable");
  const filename = exportFilename(screen, at);
  saveBlob(csvBlob(d.csv), filename);
  return { csv: d.csv, rows: Number(d.rows ?? 0), truncated: d.truncated === true, filename };
}
