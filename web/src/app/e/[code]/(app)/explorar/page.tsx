"use client";

import { useMemo, useState } from "react";
import { Button, Chip, Chips, Icon, PostCard, VisionGrid, VisionTile } from "@/components/memoriesmt";
import { isRevealed } from "@/domain/event";
import { visiblePhotos, type ReactionKind } from "@/domain/photo";
import { WaitingReveal } from "@/features/reveal/WaitingReveal";
import { relativeTime, usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { MoreSheet, PhotoReactions } from "@/features/photos/components";
import { avatarOf, tagFor, visionKey, visionName } from "@/features/photos/labels";
import { react, reportPhoto } from "@/features/photos/service";
import { downloadPhoto, reactorsOf } from "@/features/photos/share";

export default function Explorar() {
  const { repos } = useApp();
  const { event, user, viewer, now, photos, reactions, participants, counts, refresh, developed } = useGuest();
  const shown = useMemo(() => visiblePhotos(event, photos, viewer, now), [event, photos, viewer, now]);
  const [moment, setMoment] = useState<string | undefined>();
  const [vision, setVision] = useState<string | undefined>();
  const [more, setMore] = useState<string | undefined>();
  const [limit, setLimit] = useState(20);

  const moments = event.moments.map((m) => ({ m, n: shown.filter((p) => p.moment === m).length })).filter((x) => x.n > 0);
  const visions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; cover: string; count: number }>();
    for (const p of shown) {
      const k = visionKey(p);
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { key: k, name: visionName(p), cover: p.id, count: 1 });
    }
    return [...map.values()];
  }, [shown]);
  const list = shown.filter((p) => (!moment || p.moment === moment) && (!vision || visionKey(p) === vision));
  const pageList = list.slice(0, limit);
  const urls = usePhotoUrls([...pageList, ...visions.map((v) => shown.find((p) => p.id === v.cover)!).filter(Boolean)]);

  async function onReact(photoId: string, kind: ReactionKind) {
    await react(repos, event, photoId, user.id, kind, now);
    await refresh();
  }

  return (
    <div className="app-screen">
      <div className="app-stack-sm">
        <p className="eyebrow app-eyebrow">Enquanto você estava na pista…</p>
        <h1 className="titulo-tela app-h1">Explorar</h1>
      </div>

      {!viewer.host && !isRevealed(event, now) ? (
        <WaitingReveal event={event} ownCount={counts.mine} totalCount={counts.total} />
      ) : shown.length === 0 ? (
        <div className="app-empty">
          <Icon name="explorar" label="Explorar" size={28} />
          <p className="corpo app-p">Nada para explorar ainda.</p>
          <p className="app-p">As visões da festa aparecem aqui assim que as fotos chegarem.</p>
        </div>
      ) : (
        <>
          <div className="app-stack-sm">
            <h2 className="titulo-card app-h1">Momentos</h2>
            <Chips label="Filtrar por momento">
              {moments.map(({ m, n }) => (
                <Chip key={m} variant="filtro" pressed={moment === m} onClick={() => setMoment(moment === m ? undefined : m)}>
                  {moment === m ? `${m} · ${n.toLocaleString("pt-BR")}` : m}
                </Chip>
              ))}
            </Chips>
          </div>
          <div className="app-stack-sm">
            <h2 className="titulo-card app-h1">Visões</h2>
            <VisionGrid>
              {visions.map((v) => (
                <VisionTile key={v.key} name={`${v.name} · ${v.count}`} imageSrc={urls[v.cover]} pressed={vision === v.key} onSelect={() => setVision(vision === v.key ? undefined : v.key)} />
              ))}
            </VisionGrid>
          </div>
          <div className={developed ? "app-stack reveal-in" : "app-stack"} style={{ gap: "var(--space-8)" }}>
            {pageList.map((p) => (
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
            {list.length > limit && <Button variant="secundario" block onClick={() => setLimit((n) => n + 20)}>Ver mais fotos</Button>}
          </div>
        </>
      )}
      {more && <MoreSheet reactors={reactorsOf(photos.find((p) => p.id === more)!, reactions, participants, user, { id: event.hostId, name: event.hostName })} editHref={`/e/${event.code}/editar/${more}`} onDownload={() => void downloadPhoto(repos, photos.find((p) => p.id === more)!)} onClose={() => setMore(undefined)} onReport={async () => { await reportPhoto(repos, more); await refresh(); }} />}
    </div>
  );
}
