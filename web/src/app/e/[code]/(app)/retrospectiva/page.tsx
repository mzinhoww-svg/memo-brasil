"use client";

import { Button, PostCard, StatGrid, StatTile } from "@/components/memoriesmt";
import { retrospectiveOpen } from "@/domain/event";
import { visiblePhotos } from "@/domain/photo";
import { formatDate, usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";
import { avatarOf, tagFor, visionName } from "@/features/photos/labels";

/** Retrospectiva: abre depois da revelação, com a capa em Instrument Serif e as fotos destacadas. */
export default function Retrospectiva() {
  const { event, viewer, now, photos, reactions, participants } = useGuest();
  const open = retrospectiveOpen(event, now, viewer.host);
  const shown = visiblePhotos(event, photos, viewer, now);
  const best = [...shown].sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || reactions.filter((r) => r.photoId === b.id).length - reactions.filter((r) => r.photoId === a.id).length).slice(0, 6);
  const urls = usePhotoUrls(best);
  const nf = (n: number) => n.toLocaleString("pt-BR");

  if (!open) {
    return (
      <div className="app-screen">
        <h1 className="titulo-tela app-h1">A retrospectiva ainda não abriu.</h1>
        <p className="corpo app-p app-muted">Ela abre quando o evento terminar e as fotos forem reveladas.</p>
        <Button href={`/e/${event.code}/agora`} block>Voltar ao Agora</Button>
      </div>
    );
  }
  return (
    <div className="app-screen">
      <div className="app-stack-sm">
        <p className="eyebrow app-eyebrow">{formatDate(event.startAt)} · {event.title}</p>
        <p className="emocao-lg app-emocao">Todo mundo viu um {event.category === "casamento" ? "casamento" : "evento"} diferente. Agora dá para ver todos.</p>
      </div>
      <StatGrid>
        <StatTile value={nf(shown.length)} label="fotos" />
        <StatTile value={nf(participants.length)} label="convidados" />
      </StatGrid>
      <div className="app-stack" style={{ gap: "var(--space-8)" }}>
        {best.map((p) => <PostCard key={p.id} vision={visionName(p)} meta={p.moment} avatar={avatarOf(p)} imageSrc={urls[p.id]} alt={`Foto de ${visionName(p)}`} caption={p.caption} tag={p.highlighted ? tagFor(event.category) : undefined} />)}
      </div>
      <Button href={`/e/${event.code}/explorar`} variant="secundario" block>Ver todas em Explorar</Button>
    </div>
  );
}
