"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { visiblePhotos } from "@/domain/photo";
import { useApp } from "@/features/app/provider";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";
import { download } from "@/features/admin/export";
import { stampDay, hhmm } from "@/features/guest/format";
import { renderEdit, renderFilmPreview, type EditState } from "@/features/photos/edit";
import { fileToImage } from "@/features/photos/capture";
import { ConvidadoEditar, type FilmId } from "@/revela/screens/ConvidadoEditar";

/** 23e · Editar foto: filme, corte, giro e data numa cópia que vai para o celular; a original continua no feed. */
export default function Editar() {
  const { photoId } = useParams<{ photoId: string }>();
  const router = useRouter();
  const { repos } = useApp();
  const { event, viewer, now, photos } = useGuest();
  const photo = visiblePhotos(event, photos, viewer, now).find((p) => p.id === photoId);
  const urls = usePhotoUrls(photo ? [photo] : [], "full");
  const photoUrl = photo ? urls[photo.id] : undefined;
  const [s, setS] = useState<EditState>({ film: "filme400", rotate: 0, square: false, date: true });
  const [msg, setMsg] = useState<string | undefined>();
  const back = `/e/${event.code}/agora`;
  const [preview, setPreview] = useState<string | undefined>();
  const photoCreatedAt = photo?.createdAt;
  const filmNow = s.film;
  useEffect(() => {
    // Prévia com o mesmo renderFilm da foto salva, sobre a cópia reduzida da original.
    const url = photoUrl;
    if (!url || photoCreatedAt === undefined) return;
    let off = false, made: string | undefined;
    (async () => {
      try {
        const res = await fetch(url);
        const img = await fileToImage(new File([await res.blob()], "foto", { type: "image/jpeg" }));
        const blob = await renderFilmPreview(img, filmNow, new Date(photoCreatedAt));
        made = URL.createObjectURL(blob);
        if (off) URL.revokeObjectURL(made); else setPreview(made);
      } catch { if (!off) setPreview(undefined); }
    })();
    return () => { off = true; if (made) URL.revokeObjectURL(made); };
  }, [photoUrl, photoCreatedAt, filmNow]);
  useEffect(() => { if (!photo) router.replace(back); }, [photo, router, back]);
  if (!photo) return null;

  const stampBase = new Date(photo.createdAt);
  const capLeft = `${stampDay(photo.createdAt, event.timezone).split(" ").slice(1).join(" ")} · ${hhmm(photo.createdAt, event.timezone)}`;
  async function save() {
    try {
      const d = await repos.photos.getData(photo!.id);
      if (!d) return setMsg("Não achamos os bytes desta foto neste aparelho.");
      const img = await fileToImage(new File([d.bytes], "foto", { type: d.type }));
      const blob = await renderEdit(img, s, stampBase);
      download(blob, `revela-editada-${photo!.id.slice(0, 8)}.jpg`);
      setMsg(undefined);
    } catch { setMsg("Não deu para salvar. Tente de novo."); }
  }
  return (
    <>
      <ConvidadoEditar src={preview ?? photoUrl ?? ""} alt={`Foto de ${photo.authorName}`} capLeft={capLeft} capRight={`por ${photo.authorName}`} film={s.film} rotate={s.rotate}
        onFilm={(film: FilmId) => setS((x) => ({ ...x, film }))} onClose={() => router.push(back)}
        onSave={() => void save().then(() => router.push(back))} onCrop={() => setS((x) => ({ ...x, square: !x.square }))} onRotate={() => setS((x) => ({ ...x, rotate: (x.rotate + 90) % 360 }))}
        onDate={() => setS((x) => ({ ...x, date: !x.date }))} onDownload={() => void save()} />
      {msg && <p className="rv-field-erro rv-toast-in" role="alert" style={{ position: "fixed", left: 20, right: 20, bottom: 24, textAlign: "center", zIndex: 40 }}>{msg}</p>}
    </>
  );
}
