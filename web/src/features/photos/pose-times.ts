import type { MemoEvent } from "@/domain/event";
import type { Photo } from "@/domain/photo";
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";

/** Instantes das poses da própria pessoa (a lista de fotos vem vazia para o convidado até a revelação). */
export async function myPoseTimes(event: Pick<MemoEvent, "id">, userId: string, photos: Photo[]): Promise<number[]> {
  if (backendMode() === "supabase") {
    const { data, error } = await browserSupabase().rpc("my_pose_times", { p_event: event.id });
    if (!error && Array.isArray(data)) return data.map(Number);
  }
  return photos.filter((p) => p.authorId === userId && p.status !== "removida").sort((a, b) => a.createdAt - b.createdAt).map((p) => p.createdAt);
}
