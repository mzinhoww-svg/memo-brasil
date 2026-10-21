"use client";

import { useState } from "react";
import { Button, Progress } from "@/components/memoriesmt";
import { download, guestsCsv, zipAlbum } from "@/features/admin/export";
import { guestRanking } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";

export default function Downloads() {
  const { repos } = useApp();
  const { event, photos } = useAdmin();
  const [progress, setProgress] = useState<{ done: number; total: number } | undefined>();
  const [result, setResult] = useState<string | undefined>();
  const count = photos.filter((p) => p.status !== "removida").length;

  async function album() {
    setResult(undefined);
    setProgress({ done: 0, total: count });
    const r = await zipAlbum(repos, event, photos, (done, total) => setProgress({ done, total }));
    setProgress(undefined);
    if (r.saved === 0) return setResult("Este álbum ainda não tem fotos.");
    download(r.blob, r.filename);
    setResult(`Baixamos ${r.saved} ${r.saved === 1 ? "foto" : "fotos"}${r.missing ? `. ${r.missing} não estavam neste aparelho.` : "."}`);
  }
  async function csv() {
    download(new Blob([guestsCsv(await guestRanking(repos, event))], { type: "text/csv;charset=utf-8" }), `memoriesmt-${event.code}-convidados.csv`);
  }

  return (
    <>
      <h1 className="titulo-pagina app-h1">Downloads</h1>
      <div className="app-stack" style={{ maxWidth: 343 }}>
        <Button icon="baixar" block disabled={count === 0 || Boolean(progress)} onClick={album}>Baixar o álbum (ZIP)</Button>
        {progress && <Progress label="Preparando o álbum" status={`${progress.done} de ${progress.total}`} value={(progress.done / Math.max(1, progress.total)) * 100} />}
        {result && <p className="app-p" role="status">{result}</p>}
        <Button variant="secundario" icon="baixar" block onClick={csv}>Lista de convidados (CSV)</Button>
        <p className="mm-field-ajuda">As fotos baixadas são as que estão guardadas neste aparelho.</p>
      </div>
    </>
  );
}
