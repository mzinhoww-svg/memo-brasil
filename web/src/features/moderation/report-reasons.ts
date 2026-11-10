/** Motivos de denúncia (24g, Feed-denunciar): os códigos gravados no servidor e os rótulos do desenho, na mesma ordem das listas da tela. */
import { useCallback, useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { DENUNCIA_MOTIVOS_COMENTARIO, DENUNCIA_MOTIVOS_FOTO } from "@/revela/screens/FeedDenunciar";

export const PHOTO_REASON_CODES = ["nao_quero_aparecer", "constrangedora", "improprio", "outro"] as const;
export const COMMENT_REASON_CODES = ["ofensivo", "spam", "improprio", "outro"] as const;
export type PhotoReasonCode = (typeof PHOTO_REASON_CODES)[number];
export type CommentReasonCode = (typeof COMMENT_REASON_CODES)[number];

/** Código do motivo escolhido na lista (índice da tela); fora da lista não manda motivo. */
export const photoReasonAt = (i: number): PhotoReasonCode | undefined => PHOTO_REASON_CODES[i];
export const commentReasonAt = (i: number): CommentReasonCode | undefined => COMMENT_REASON_CODES[i];

export const REASON_LABEL: Record<string, string> = {
  ...Object.fromEntries(PHOTO_REASON_CODES.map((c, i) => [c, DENUNCIA_MOTIVOS_FOTO[i]])),
  ...Object.fromEntries(COMMENT_REASON_CODES.map((c, i) => [c, DENUNCIA_MOTIVOS_COMENTARIO[i]])),
  improprio: "Conteúdo impróprio",
  outro: "Outro motivo",
  sem_motivo: "Sem motivo informado",
};

export type ReasonCounts = Record<string, number>;
export interface ReportReasons { photos: Record<string, ReasonCounts>; comments: Record<string, ReasonCounts> }

/** "2 Conteúdo impróprio, 1 Outro motivo" (maior contagem primeiro); vazio quando não há denúncias. Nunca identifica quem denunciou. */
export function formatReasonCounts(counts: ReasonCounts | undefined | null): string {
  return Object.entries(counts ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${n} ${REASON_LABEL[k] ?? "Outro motivo"}`)
    .join(", ");
}

/** Motivos agregados do evento para o anfitrião (RPC report_reasons). Modo local não guarda motivos. */
export async function listReportReasons(eventId: string): Promise<ReportReasons> {
  if (backendMode() !== "supabase") return { photos: {}, comments: {} };
  const r = await browserSupabase().rpc("report_reasons", { p_event: eventId });
  if (r.error) throw r.error;
  const d = (r.data ?? {}) as Partial<ReportReasons>;
  return { photos: d.photos ?? {}, comments: d.comments ?? {} };
}

export function useReportReasons(eventId: string, refreshKey?: unknown): ReportReasons {
  const [data, setData] = useState<ReportReasons>({ photos: {}, comments: {} });
  const load = useCallback(async () => {
    try { setData(await listReportReasons(eventId)); } catch { /* sem motivos: a fila continua com as contagens */ }
  }, [eventId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);
  return data;
}
