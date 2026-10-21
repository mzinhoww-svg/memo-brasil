"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/features/app/provider";
import { browserSupabase } from "@/lib/supabase/client";
import { assetUrl, currentAsset } from "./assets";

/** Logo e capa do evento (URLs assinadas). Só para quem a RLS do bucket deixa ler: organizador, membros e master. Em modo local não há imagens. */
export function useBrandImages(eventId: string | undefined): { logoUrl?: string; coverUrl?: string } {
  const { backend } = useApp();
  const [urls, setUrls] = useState<{ logoUrl?: string; coverUrl?: string }>({});
  useEffect(() => {
    if (backend !== "supabase" || !eventId) return;
    let alive = true;
    const sb = browserSupabase();
    void (async () => {
      const [l, c] = await Promise.all([currentAsset(sb, eventId, "logo"), currentAsset(sb, eventId, "cover")]);
      const next = { logoUrl: l ? await assetUrl(sb, l) : undefined, coverUrl: c ? await assetUrl(sb, c) : undefined };
      if (alive) setUrls(next);
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [backend, eventId]);
  return urls;
}
