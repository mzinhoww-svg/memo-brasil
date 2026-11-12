"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Sheet } from "@/components/revela";
import { useEventData, usePhotoUrls } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { moderate } from "@/features/admin/service";
import { firstName, initialOf, photoMoment, poseLabel, printStamp } from "@/features/feed/format";
import { downloadPhoto, reactorsOf } from "@/features/photos/share";
import { useFirstOpen } from "@/lib/motion/use-moments";
import { ReveladosFoto } from "@/revela/screens/ReveladosFoto";
import { GoHome, HostNote, LoadingNote } from "./use-revealed";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** 19 · Foto aberta de um evento revelado (anfitrião): destacar, baixar, compartilhar e mais opções. */
export function PhotoView({ id, photoId }: { id: string; photoId: string }) {
  const router = useRouter();
  const { repos, user } = useApp();
  const data = useEventData({ id });
  const { event, photos, reactions, participants, refresh } = data;
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  const list = useMemo(() => photos.filter((p) => p.status !== "removida" && p.uploadStatus === "pronta").sort((a, b) => photoMoment(a) - photoMoment(b) || a.id.localeCompare(b.id)), [photos]);
  const i = list.findIndex((p) => p.id === photoId);
  const photo = list[i];
  const urls = usePhotoUrls([photo, list[i - 1], list[i + 1]].filter((p) => p !== undefined));
  const develop = useFirstOpen(photo?.id); // a foto "revela" só na primeira vez que abre
  const base = `/eventos/revelados/${id}`;
  const go = (j: number) => { if (list[j]) router.replace(`${base}/${list[j].id}`); };

  // setas e deslize para passar de foto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") go(i - 1); if (e.key === "ArrowRight") go(i + 1); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, list]);
  const x0 = useRef<number | null>(null);

  if (data.loading) return <LoadingNote />;
  if (!event || data.access !== "organizador" || !photo) return <HostNote title="Não achamos esta foto." text="Ela foi removida ou não é de um evento seu." action={<GoHome />} />;

  async function download() {
    setNote((await downloadPhoto(repos, photo).catch(() => false)) ? "Foto baixada." : "Não deu para baixar essa foto. Tente de novo.");
  }
  async function share() {
    try {
      const d = await repos.photos.getData(photo.id);
      if (d) {
        const file = new File([d.bytes], `revela-${photo.id.slice(0, 8)}.${d.type === "image/png" ? "png" : "jpg"}`, { type: d.type });
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: event!.title }); return; }
      }
      await download();
    } catch { /* cancelado pela pessoa */ }
  }
  async function star() {
    await moderate(repos, photo.id, "destacar");
    await refresh();
  }
  async function act(action: "ocultar" | "mostrar" | "remover") {
    await moderate(repos, photo.id, action);
    await refresh();
    setMore(false);
    if (action === "remover") router.replace(base);
  }

  return (
    <div
      onTouchStart={(e) => { x0.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - (x0.current ?? e.changedTouches[0].clientX); x0.current = null; if (Math.abs(d) > 60) go(d < 0 ? i + 1 : i - 1); }}
    >
      <ReveladosFoto
        position={`${i + 1} de ${list.length}`} imageSrc={urls[photo.id] ?? BLANK} develop={develop}
        stampLeft={printStamp(photoMoment(photo), event.timezone)} stampRight={`por ${firstName(photo.authorName)}`}
        avatar={initialOf(photo.authorName)} author={firstName(photo.authorName)} meta={poseLabel(photo, list, event)}
        highlighted={photo.highlighted} closeHref={base}
        onMore={() => setMore(true)} onStar={() => void star()} onDownload={() => void download()} downloadLabel="Baixar em alta" onShare={() => void share()}
        onPrev={i > 0 ? () => go(i - 1) : undefined} onNext={i < list.length - 1 ? () => go(i + 1) : undefined}
      />
      {note && <p className="rv-caption" role="status" style={{ position: "fixed", left: 0, right: 0, bottom: 4, textAlign: "center", zIndex: 5 }}>{note}</p>}
      {more && (
        <Sheet title="Mais opções" onClose={() => { setMore(false); setConfirm(false); }}>
          <section className="app-stack-sm" aria-labelledby="quem">
            <h3 id="quem" className="nome app-h1">Quem reagiu</h3>
            {(() => {
              const rs = reactorsOf(photo, reactions, participants, user!, { id: event.hostId, name: event.hostName });
              return rs.length === 0 ? <p className="app-p app-muted">Ninguém reagiu a esta foto ainda.</p> : <ul className="app-stack-sm" style={{ margin: 0, padding: 0, listStyle: "none" }}>{rs.map((r) => <li key={r.name + r.label} className="app-between"><span>{r.name}</span><span className="app-muted">{r.label}</span></li>)}</ul>;
            })()}
          </section>
          <Button variant="secundario" block onClick={() => void act(photo.status === "oculta" ? "mostrar" : "ocultar")}>{photo.status === "oculta" ? "Mostrar para os convidados" : "Esconder dos convidados"}</Button>
          {confirm ? (
            <>
              <p className="corpo app-p">Remover esta foto de vez? Não dá para desfazer.</p>
              <Button variant="destrutivo" block onClick={() => void act("remover")}>Remover foto</Button>
            </>
          ) : <Button variant="destrutivo" block onClick={() => setConfirm(true)}>Remover foto</Button>}
          <Button variant="texto" block onClick={() => { setMore(false); setConfirm(false); }}>Fechar</Button>
        </Sheet>
      )}
    </div>
  );
}
