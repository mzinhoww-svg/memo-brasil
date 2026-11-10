"use client";

import { useMemo } from "react";
import { useEventData, usePhotoUrls } from "@/features/app/hooks";
import { pickGallery } from "./pick";
import { ReveladosAlbum } from "@/revela/screens/ReveladosAlbum";
import { GoHome, HostNote, LoadingNote } from "./use-revealed";

/** "14 · 03 · 2027" no fuso do evento. */
export function albumDate(ts: number, tz = "America/Cuiaba"): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(ts))) p[x.type] = x.value;
  return `${p.day} · ${p.month} · ${p.year}`;
}

/** 19b · Álbum impresso: a oferta do álbum em papel com as fotos do evento. */
export function AlbumView({ id }: { id: string }) {
  const data = useEventData({ id });
  const { event, photos, reactions } = data;
  const ready = useMemo(() => photos.filter((p) => p.status !== "removida" && p.uploadStatus === "pronta"), [photos]);
  const picks = useMemo(() => pickGallery(ready, reactions, { n: 2 }), [ready, reactions]);
  const urls = usePhotoUrls(picks);
  if (data.loading) return <LoadingNote />;
  if (!event || data.access !== "organizador") return <HostNote title="Não achamos este álbum." text="Ele não existe ou não é de um evento seu." action={<GoHome />} />;
  const chosen = ready.filter((p) => p.highlighted).length || Math.min(60, ready.length);
  const covers = picks.map((p) => urls[p.id]).filter(Boolean);
  return (
    <ReveladosAlbum
      title={event.title} date={albumDate(event.startAt, event.timezone)}
      covers={covers.length >= 2 ? [covers[0], covers[1]] : undefined}
      lead={`${chosen} ${chosen === 1 ? "foto escolhida" : "fotos escolhidas"} por você, capa dura de linho, entregue em casa.`}
      closeHref={`/eventos/revelados/${event.id}`} chooseHref={`/painel/${event.id}/conteudo`}
    />
  );
}
