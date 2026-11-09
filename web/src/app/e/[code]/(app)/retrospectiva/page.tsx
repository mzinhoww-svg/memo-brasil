"use client";

import Link from "next/link";
import { useMemo } from "react";
import { retrospectiveOpen } from "@/domain/event";
import { visiblePhotos } from "@/domain/photo";
import { useGuest } from "@/features/events/guest-context";
import { retrospective } from "@/features/feed/retro";
import { stampDay } from "@/features/guest/format";
import { FeedRetrospectiva } from "@/revela/screens/FeedRetrospectiva";

/** 24h · Retrospectiva: abre depois da revelação, com os números reais do evento. */
export default function Retrospectiva() {
  const { event, viewer, now, photos, reactions } = useGuest();
  const open = retrospectiveOpen(event, now, viewer.host);
  const shown = useMemo(() => visiblePhotos(event, photos, viewer, now), [event, photos, viewer, now]);
  const data = useMemo(() => {
    const ids = new Set(shown.map((p) => p.id));
    return retrospective(shown, reactions.filter((r) => ids.has(r.photoId)), { tz: event.timezone || "America/Cuiaba", shotsPerPerson: event.shotsPerPerson });
  }, [shown, reactions, event.timezone, event.shotsPerPerson]);

  if (!open) {
    return (
      <div className="scr">
        <div className="safe">
          <h1 className="rv-title-lg">A retrospectiva ainda não abriu.</h1>
          <p className="rv-body muted" style={{ margin: "10px 0 16px" }}>Ela abre quando o evento terminar e as fotos forem reveladas.</p>
          <Link href={`/e/${event.code}/agora`} className="rv-btn rv-btn--block rv-btn--primary">Voltar ao Feed</Link>
        </div>
      </div>
    );
  }
  const year = new Intl.DateTimeFormat("pt-BR", { timeZone: event.timezone || "America/Cuiaba", year: "numeric" }).format(new Date(event.startAt));
  return (
    <FeedRetrospectiva
      backHref={`/e/${event.code}/agora`} stamp={`${stampDay(event.startAt, event.timezone)} ${year}`}
      headline={[`O ${event.category === "casamento" ? "casamento" : "evento"}`, `em ${shown.length.toLocaleString("pt-BR")} ${shown.length === 1 ? "foto" : "fotos"}`]}
      tiles={data.tiles} bars={data.bars} shooters={data.shooters}
    />
  );
}
