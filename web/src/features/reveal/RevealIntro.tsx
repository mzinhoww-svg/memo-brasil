"use client";

import { useMemo } from "react";
import { visiblePhotos } from "@/domain/photo";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";
import { firstName, photoMoment, printDate } from "@/features/feed/format";
import { hhmm, stampDay } from "@/features/guest/format";
import { FeedAviso } from "@/revela/screens/FeedAviso";
import { FeedRevelou } from "@/revela/screens/FeedRevelou";

/** "As 418 fotos de Ana & Leo estão prontas. 27 são suas." com singular e sem "0 são suas". */
export function revealText(title: string, total: number, mine: number, where: "prontas" | "no feed"): string {
  const head = where === "prontas"
    ? `${total === 1 ? "A foto" : `As ${total.toLocaleString("pt-BR")} fotos`} de ${title} ${total === 1 ? "está pronta" : "estão prontas"}.`
    : `${total === 1 ? "A foto" : `As ${total.toLocaleString("pt-BR")} fotos`} de ${title} ${total === 1 ? "está" : "estão"} no feed.`;
  const own = mine === 0 ? "" : ` ${mine === 1 ? "1 é sua" : `${mine.toLocaleString("pt-BR")} são suas`}.`;
  return head + own;
}

/** 24b (a notificação) e 24c (Revelou.) com as fotos e contagens reais do evento. */
export function RevealIntro({ stage, onOpen }: { stage: "aviso" | "revelou"; onOpen: () => void }) {
  const { event, user, viewer, now, photos, counts } = useGuest();
  const picks = useMemo(() => {
    const all = visiblePhotos(event, photos, viewer, now).sort((a, b) => photoMoment(b) - photoMoment(a));
    const own = all.find((p) => p.authorId === user.id);
    const others = all.filter((p) => p.id !== own?.id && p.authorId !== user.id).slice(0, own ? 2 : 3);
    return [...others, ...(own ? [own] : [])];
  }, [event, photos, viewer, now, user.id]);
  const urls = usePhotoUrls(picks);
  const at = event.revealedAt ?? event.revealAt ?? now;
  if (stage === "aviso") {
    return <FeedAviso stamp={stampDay(at, event.timezone)} time={hhmm(now, event.timezone)} body={revealText(event.title, counts.total, counts.mine, "no feed")} background={urls[picks[0]?.id ?? ""]} onOpen={onOpen} />;
  }
  return (
    <FeedRevelou
      stamp={`${stampDay(at, event.timezone)} · ${hhmm(at, event.timezone)}`} text={revealText(event.title, counts.total, counts.mine, "prontas")} expected={picks.length} onOpen={onOpen}
      prints={picks.filter((p) => urls[p.id]).map((p) => ({ src: urls[p.id], stampLeft: printDate(photoMoment(p), event.timezone), stampRight: p.authorId === user.id ? "você" : firstName(p.authorName) }))}
    />
  );
}
