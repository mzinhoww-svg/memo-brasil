"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Sheet } from "@/components/revela";
import { useEventData, usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { firstName, photoMoment, printDate } from "@/features/feed/format";
import { ReveladosGaleria } from "@/revela/screens/ReveladosGaleria";
import { GoHome, HostNote, LoadingNote, useRevealedEvents } from "./use-revealed";
import { pickGallery, whenLabel } from "./pick";

/** Texto "Ana & Leo · 418 fotos de 32 convidados · hoje, 12:00" com singular e sem convidados quando ninguém entrou. */
export function galleryCaption(title: string, photos: number, guests: number, when: string): string {
  const f = `${photos.toLocaleString("pt-BR")} ${photos === 1 ? "foto" : "fotos"}`;
  return `${title} · ${guests > 0 ? `${f} de ${guests.toLocaleString("pt-BR")} ${guests === 1 ? "convidado" : "convidados"}` : f} · ${when}`;
}

/** 18 · Revelados: galeria do evento revelado. */
export function Gallery({ id }: { id: string }) {
  const router = useRouter();
  const { now } = useApp();
  const data = useEventData({ id });
  const { events } = useRevealedEvents();
  const [filtering, setFiltering] = useState(false);
  const [author, setAuthor] = useState<string | undefined>();
  const { event, photos, participants, reactions } = data;

  const visible = useMemo(() => photos.filter((p) => p.status !== "removida" && p.uploadStatus === "pronta"), [photos]);
  const picks = useMemo(() => pickGallery(visible, reactions, { authorId: author }), [visible, reactions, author]);
  const urls = usePhotoUrls(picks);
  const authors = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    for (const p of visible) m.set(p.authorId, { id: p.authorId, name: p.authorName, n: (m.get(p.authorId)?.n ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [visible]);

  if (data.loading) return <LoadingNote />;
  if (!event || data.access !== "organizador") return <HostNote title="Não achamos esta galeria." text="Ela não existe ou não é de um evento seu." action={<GoHome />} />;

  const at = event.revealedAt ?? event.revealAt ?? event.startAt;
  const others = (events ?? []).filter((e) => e.id !== event.id);
  return (
    <>
      <ReveladosGaleria
        caption={galleryCaption(event.title, author ? visible.filter((p) => p.authorId === author).length : visible.length, participants.length, whenLabel(at, now(), event.timezone))}
        prints={picks.map((p) => ({ src: urls[p.id] ?? "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", stampLeft: printDate(photoMoment(p), event.timezone), stampRight: firstName(p.authorName), href: `/eventos/revelados/${event.id}/${p.id}` }))}
        backHref="/eventos" downloadHref={`/painel/${event.id}/downloads`} albumHref={`/eventos/revelados/${event.id}/album`}
        onFilter={() => setFiltering(true)} empty={picks.length === 0 ? "Ainda não há fotos aqui." : undefined}
      />
      {filtering && (
        <Sheet title="Filtrar" onClose={() => setFiltering(false)}>
          <section className="app-stack-sm" aria-labelledby="por-convidado">
            <h3 id="por-convidado" className="nome app-h1">Por convidado</h3>
            <Button variant={author ? "secundario" : "primario"} block onClick={() => { setAuthor(undefined); setFiltering(false); }}>Todos</Button>
            {authors.map((a) => (
              <Button key={a.id} variant={author === a.id ? "primario" : "secundario"} block onClick={() => { setAuthor(a.id); setFiltering(false); }}>{`${a.name} · ${a.n} ${a.n === 1 ? "foto" : "fotos"}`}</Button>
            ))}
          </section>
          {others.length > 0 && (
            <section className="app-stack-sm" aria-labelledby="outro-evento">
              <h3 id="outro-evento" className="nome app-h1">Outro evento revelado</h3>
              {others.map((e) => <Button key={e.id} variant="secundario" block onClick={() => { setFiltering(false); router.push(`/eventos/revelados/${e.id}`); }}>{e.title}</Button>)}
            </section>
          )}
          <Button variant="texto" block onClick={() => setFiltering(false)}>Fechar</Button>
        </Sheet>
      )}
    </>
  );
}
