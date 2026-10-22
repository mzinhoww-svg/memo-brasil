"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Icon, LiveIndicator, Notice, PostCard } from "@/components/memoriesmt";
import { eventStatus, isRevealed, retrospectiveOpen } from "@/domain/event";
import { visiblePhotos, type ReactionKind } from "@/domain/photo";
import { relativeTime, usePhotoUrls } from "@/features/app/hooks";
import { WaitingReveal } from "@/features/reveal/WaitingReveal";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { MoreSheet, PhotoReactions } from "@/features/photos/components";
import { avatarOf, tagFor, visionName } from "@/features/photos/labels";
import { react, reportPhoto } from "@/features/photos/service";
import { downloadPhoto, reactorsOf } from "@/features/photos/share";
import { plural } from "@/lib/plural";

export default function Agora() {
  const { repos } = useApp();
  const { event, user, viewer, now, photos, reactions, participants, counts, refresh, revealStatus, developed } = useGuest();
  const [more, setMore] = useState<string | undefined>();
  const [limit, setLimit] = useState(20);
  const shown = visiblePhotos(event, photos, viewer, now);
  const page = shown.slice(0, limit);
  const urls = usePhotoUrls(page);
  const live = eventStatus(event, now) === "ativo";
  const pending = !viewer.host && !isRevealed(event, now);

  async function onReact(photoId: string, kind: ReactionKind) {
    await react(repos, event, photoId, user.id, kind, now);
    await refresh();
  }

  return (
    <div className="app-screen">
      <div className="app-stack-sm">
        <div className="app-between">
          {live ? <LiveIndicator /> : <span className="eyebrow app-muted">Encerrado</span>}
          {!pending && <span className="meta app-muted">{shown.length.toLocaleString("pt-BR")} {plural(shown.length, "foto", "fotos")}</span>}
        </div>
        <h1 className="titulo-tela app-h1">Agora</h1>
        <p className="app-p app-muted" style={{ fontFamily: "var(--font-evento)", fontSize: 30, lineHeight: 1.05, color: "var(--evento-profundo)" }}>{event.title}</p>
      </div>

      {!live && retrospectiveOpen(event, now, viewer.host) && <Link className="mm-btn mm-btn--secundario mm-btn--bloco" href={`/e/${event.code}/retrospectiva`}>Ver a retrospectiva</Link>}

      {event.notice && (!event.notice.expiresAt || event.notice.expiresAt > now) && <Notice text={event.notice.text} eyebrow={event.category === "casamento" ? "Aviso · cerimonial" : "Aviso · organização"} />}

      {pending ? (
        <WaitingReveal event={event} ownCount={counts.mine} totalCount={counts.total} />
      ) : viewer.host && revealStatus === "pendente" ? (
        <div className="app-banner" role="status">
          <Icon name="agora" decorative size={22} />
          <span>Revelação pendente: os convidados ainda não veem as fotos. Você vê tudo como anfitrião.</span>
        </div>
      ) : null}

      {pending ? null : shown.length === 0 ? (
        <div className="app-empty">
          <Icon name="camera" label="Câmera" size={28} />
          <p className="corpo app-p">Ainda sem fotos.</p>
          <p className="app-p">Viu alguma coisa boa? Posta.</p>
        </div>
      ) : (
        <div className={developed ? "app-stack reveal-in" : "app-stack"} style={{ gap: "var(--space-8)" }}>
          {page.map((p) => (
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
          {shown.length > limit && <Button variant="secundario" block onClick={() => setLimit((n) => n + 20)}>Ver mais fotos</Button>}
        </div>
      )}
      {more && (
        <MoreSheet
          reactors={reactorsOf(photos.find((p) => p.id === more)!, reactions, participants, user, { id: event.hostId, name: event.hostName })}
          editHref={`/e/${event.code}/editar/${more}`} onDownload={() => void downloadPhoto(repos, photos.find((p) => p.id === more)!)}
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
