"use client";

import Link from "next/link";
import { useMemo } from "react";
import { endAt, retrospectiveOpen } from "@/domain/event";
import { visiblePhotos } from "@/domain/photo";
import { useGuest } from "@/features/events/guest-context";
import { retroHeadline, retrospective } from "@/features/feed/retro";
import { stampDay } from "@/features/guest/format";
import { useSmartBack } from "@/lib/smart-back";
import { FeedRetrospectiva } from "@/revela/screens/FeedRetrospectiva";

/** 24h · Retrospectiva: abre depois da revelação, com os números reais do evento. */
export default function Retrospectiva() {
  const { event, viewer, now, photos, reactions } = useGuest();
  const back = useSmartBack(`/e/${event.code}/agora`);
  const open = retrospectiveOpen(event, now, viewer.host);
  // o anfitrião vê os números do evento todo (menos fotos removidas); o convidado, só as fotos que já pode ver
  const shown = useMemo(
    () => (viewer.host ? photos.filter((p) => p.status !== "removida") : visiblePhotos(event, photos, viewer, now)),
    [event, photos, viewer, now],
  );
  const data = useMemo(() => retrospective(shown, reactions, { tz: event.timezone || "America/Cuiaba", shotsPerPerson: event.shotsPerPerson, window: { start: event.startAt, end: endAt(event) } }),
    [shown, reactions, event]);

  if (!open) {
    return (
      <div className="scr">
        <div className="safe">
          <h1 className="rv-title-lg">A retrospectiva ainda não abriu.</h1>
          <p className="rv-body muted" style={{ margin: "10px 0 16px" }}>Ela abre quando o evento terminar e as fotos forem reveladas.</p>
          <Link href={`/e/${event.code}/agora`} className="rv-btn rv-btn--block rv-btn--primary" onClick={(e) => { e.preventDefault(); back(); }}>Voltar</Link>
        </div>
      </div>
    );
  }
  const year = new Intl.DateTimeFormat("pt-BR", { timeZone: event.timezone || "America/Cuiaba", year: "numeric" }).format(new Date(event.startAt));
  return (
    <FeedRetrospectiva
      backHref={`/e/${event.code}/agora`} onBack={back} stamp={`${stampDay(event.startAt, event.timezone)} ${year}`}
      headline={retroHeadline(event.category, shown.length)}
      tiles={data.tiles} bars={data.bars} shooters={data.shooters}
    />
  );
}
