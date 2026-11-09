/** Moderação de comentários do anfitrião (RPC list_comments_for_moderation / moderate_comment). Modo local não tem comentários. */
import { useCallback, useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

export interface ModComment {
  id: string;
  photoId: string;
  authorName: string;
  body: string;
  reports: number;
  hidden: boolean;
  hiddenBy: "denuncias" | "anfitriao" | "master" | null;
  createdAt: number;
}
export type CommentAction = "esconder" | "mostrar" | "remover";

/** Denúncias a partir das quais o servidor esconde o comentário sozinho (report_comment). */
export const AUTO_HIDE_REPORTS = 3;

export async function listCommentsForModeration(eventId: string): Promise<ModComment[]> {
  if (backendMode() !== "supabase") return [];
  const r = await browserSupabase().rpc("list_comments_for_moderation", { p_event: eventId });
  if (r.error) throw r.error;
  return ((r.data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string, photoId: c.photoId as string, authorName: (c.authorName as string) ?? "", body: (c.body as string) ?? "",
    reports: Number(c.reports ?? 0), hidden: Boolean(c.hidden), hiddenBy: (c.hiddenBy as ModComment["hiddenBy"]) ?? null, createdAt: Date.parse(c.createdAt as string),
  }));
}

export async function moderateComment(commentId: string, action: CommentAction): Promise<void> {
  if (backendMode() !== "supabase") return;
  const r = await browserSupabase().rpc("moderate_comment", { p_comment: commentId, p_action: action, p_reason: null });
  if (r.error) throw r.error;
}

/** Fila de comentários do evento (com denúncia ou escondidos). Falha de rede deixa a fila vazia e `failed` ligado. */
export function useModerationComments(eventId: string): { comments: ModComment[]; failed: boolean; reload: () => Promise<void> } {
  const [comments, setComments] = useState<ModComment[]>([]);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try { setComments(await listCommentsForModeration(eventId)); setFailed(false); } catch { setFailed(true); }
  }, [eventId]);
  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);
  return { comments, failed, reload };
}
