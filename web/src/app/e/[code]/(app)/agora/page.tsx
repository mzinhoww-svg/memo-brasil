"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, LiveIndicator, Notice, PostCard } from "@/components/memoriesmt";
import { eventStatus, isRevealed, revealAt } from "@/domain/event";
import { visiblePhotos, type ReactionKind } from "@/domain/photo";
import { formatDate, formatTime, relativeTime, usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { MoreSheet, PhotoReactions } from "@/features/photos/components";
import { avatarOf, tagFor, visionName } from "@/features/photos/labels";
import { react, reportPhoto } from "@/features/photos/service";

export default function Agora() {
  const { repos } = useApp();
  const { event, user, viewer, now, photos, reactions, refresh } = useGuest();
  const [more, setMore] = useState<string | undefined>();
  const shown = visiblePhotos(event, photos, viewer, now);
  const urls = usePhotoUrls(shown);
  const live = eventStatus(event, now) === "ativo";
  const hiddenOthers = !viewer.host && !isRevealed(event, now);

  async function onReact(photoId: string, kind: ReactionKind) {
    await react(repos, event, photoId, user.id, kind);
    await refresh();
  }

  return (
    <div className="app-screen">
      <div className="app-stack-sm">
        <div className="app-between">
          {live ? <LiveIndicator /> : <span className="eyebrow app-muted">Encerrado</span>}
          <span className="meta app-muted">{shown.length.toLocaleString("pt-BR")} fotos</span>
        </div>
        <h1 className="titulo-tela app-h1">Agora</h1>
        <p className="app-p app-muted" style={{ fontFamily: "var(--font-evento)", fontSize: 30, lineHeight: 1.05, color: "var(--evento-profundo)" }}>{event.title}</p>
      </div>

      {!live && isRevealed(event, now) && <Link className="mm-btn mm-btn--secundario mm-btn--bloco" href={`/e/${event.code}/retrospectiva`}>Ver a retrospectiva</Link>}

      {event.notice && (!event.notice.expiresAt || event.notice.expiresAt > now) && <Notice text={event.notice.text} eyebrow={event.category === "casamento" ? "Aviso · cerimonial" : "Aviso · organização"} />}

      {hiddenOthers && event.everyoneSeesAll && (
        <div className="app-banner" role="status">
          <Icon name="agora" decorative size={22} />
          <span>
            As fotos dos outros aparecem {event.revealTiming === "ao-terminar" ? "quando o evento terminar" : `em ${formatDate(revealAt(event))} · ${formatTime(revealAt(event))}`}. As suas já estão aqui.
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="app-empty">
          <Icon name="camera" label="Câmera" size={28} />
          <p className="corpo app-p">Ainda sem fotos.</p>
          <p className="app-p">Viu alguma coisa boa? Posta.</p>
        </div>
      ) : (
        <div className="app-stack" style={{ gap: "var(--space-8)" }}>
          {shown.map((p) => (
            <PostCard
              key={p.id}
              vision={visionName(p)}
              meta={`${p.moment} · ${relativeTime(p.createdAt, now)}`}
              avatar={avatarOf(p)}
              imageSrc={urls[p.id]}
              alt={`Foto de ${visionName(p)}, momento ${p.moment}`}
              caption={p.caption}
              tag={p.highlighted ? tagFor(event.category) : undefined}
              onMore={() => setMore(p.id)}
              reactions={event.reactionsEnabled ? <PhotoReactions photo={p} reactions={reactions} userId={user.id} onReact={onReact} /> : undefined}
            />
          ))}
        </div>
      )}
      {more && (
        <MoreSheet
          onClose={() => setMore(undefined)}
          onReport={async () => {
            await reportPhoto(repos, more);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
