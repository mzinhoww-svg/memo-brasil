"use client";

import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs, Button } from "@/components/revela";
import { visiblePhotos } from "@/domain/photo";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { PhotoEditor } from "@/features/photos/editor";

export default function Editar() {
  const { photoId } = useParams<{ photoId: string }>();
  const router = useRouter();
  const { repos } = useApp();
  const { event, viewer, now, photos } = useGuest();
  const visible = visiblePhotos(event, photos, viewer, now);
  const photo = visible.find((p) => p.id === photoId);
  if (!photo) {
    return (
      <div className="app-screen">
        <h1 className="titulo-tela app-h1">Essa foto não está disponível.</h1>
        <Button href={`/e/${event.code}/agora`} block>Voltar ao Agora</Button>
      </div>
    );
  }
  return (
    <div className="app-screen">
      <Breadcrumbs items={[{ label: "Agora", href: `/e/${event.code}/agora` }, { label: "Editar foto" }]} />
      <h1 className="titulo-tela app-h1">Editar foto</h1>
      <PhotoEditor repos={repos} photo={photo} others={visible} onDone={() => router.push(`/e/${event.code}/agora`)} />
    </div>
  );
}
