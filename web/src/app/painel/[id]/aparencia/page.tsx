"use client";

import { useCallback, useEffect, useState } from "react";
import { AppearanceStudio, type StudioImages } from "@/features/studio/AppearanceStudio";
import { assetUrl, currentAsset, uploadBrandAsset, type AssetKind } from "@/features/studio/assets";
import { browserSupabase } from "@/lib/supabase/client";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { restoreDefaultTheme, saveTheme } from "@/features/events/theme";
import { computeRevealStatus } from "@/domain/reveal";

const MOTIVO = { invalido: "Tema inválido: confira as cores.", bloqueado: "A revelação já aconteceu; não dá para mudar.", inexistente: "Evento não encontrado." } as const;

async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const d = { width: bmp.width, height: bmp.height };
  bmp.close();
  return d;
}

export default function Aparencia() {
  const { repos, now: clock, backend } = useApp();
  const { event, now, refresh } = useAdmin();
  const cloud = backend === "supabase";
  const [urls, setUrls] = useState<{ logoUrl?: string; coverUrl?: string }>({});
  const fetchUrls = useCallback(async () => {
    const sb = browserSupabase();
    const [l, c] = await Promise.all([currentAsset(sb, event.id, "logo"), currentAsset(sb, event.id, "cover")]);
    return { logoUrl: l ? await assetUrl(sb, l) : undefined, coverUrl: c ? await assetUrl(sb, c) : undefined };
  }, [event.id]);
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    void fetchUrls().then((u) => { if (alive) setUrls(u); });
    return () => { alive = false; };
  }, [cloud, fetchUrls]);
  const images: StudioImages | undefined = cloud ? {
    ...urls,
    onUpload: async (kind: AssetKind, file: File) => {
      try { await uploadBrandAsset(browserSupabase(), event.id, kind, file, await imageSize(file)); setUrls(await fetchUrls()); return undefined; } catch (e) { return e instanceof Error ? e.message : "Falha no envio."; }
    },
  } : undefined;
  const locked = event.revealEnabled && computeRevealStatus(event, now) === "revelada";
  return (
    <AppearanceStudio
      event={event}
      locked={locked}
      images={images}
      onSave={async (t) => { const r = await saveTheme(repos, event.id, t, clock()); await refresh(); return r.ok ? undefined : MOTIVO[r.reason]; }}
      onRestore={async () => { const r = await restoreDefaultTheme(repos, event.id, clock()); await refresh(); return r.ok ? undefined : MOTIVO[r.reason]; }}
    />
  );
}
