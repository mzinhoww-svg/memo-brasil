"use client";

import { useState } from "react";
import { Button, Progress } from "@/components/revela";
import { download, guestsCsv, zipAlbum } from "@/features/admin/export";
import { guestRanking } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { copyFor } from "@/features/app/copy";
import { backendMode } from "@/lib/supabase/env";

export default function Downloads() {
  const { repos } = useApp();
  const { event, photos } = useAdmin();
  const [progress, setProgress] = useState<{ done: number; total: number } | undefined>();
  const [result, setResult] = useState<string | undefined>();
  const [error, setError] = useState<string>();
  const [csvBusy, setCsvBusy] = useState(false);
  const count = photos.filter((p) => p.status !== "removida").length;

  async function album() {
    if (progress) return;
    setResult(undefined);
    setError(undefined);
    setProgress({ done: 0, total: count });
    try {
      const r = await zipAlbum(repos, event, photos, (done, total) => setProgress({ done, total }));
      if (r.saved === 0) { setError(`Nenhuma foto pôde ser incluída; ${r.missing} ausentes. Tente de novo.`); return; }
      download(r.blob, r.filename);
      setResult(copyFor(backendMode()).downloadsSaved(r.saved, r.missing));
    } catch {
      setError("Não foi possível preparar o álbum. Tente de novo.");
    } finally {
      setProgress(undefined);
    }
  }
  async function csv() {
    if (csvBusy) return;
    setError(undefined);
    setCsvBusy(true);
    try {
      download(new Blob([guestsCsv(await guestRanking(repos, event))], { type: "text/csv;charset=utf-8" }), `revela-${event.code}-convidados.csv`);
    } catch {
      setError("Não foi possível preparar a lista. Tente de novo.");
    } finally { setCsvBusy(false); }
  }

  return (
    <>
      <h1 className="titulo-pagina app-h1">Downloads</h1>
      <div className="app-stack app-form-col">
        <Button icon="baixar" block disabled={count === 0 || Boolean(progress)} onClick={album}>Baixar o álbum (ZIP)</Button>
        {progress && <Progress label="Preparando o álbum" status={`${progress.done} de ${progress.total}`} value={(progress.done / Math.max(1, progress.total)) * 100} />}
        {error && <p className="app-p" role="alert">{error}</p>}
        {result && <p className="app-p" role="status">{result}</p>}
        <Button variant="secundario" icon="baixar" block disabled={csvBusy} onClick={csv}>Lista de convidados (CSV)</Button>
        <p className="app-p app-muted">{copyFor(backendMode()).downloadsNote}</p>
      </div>
    </>
  );
}
