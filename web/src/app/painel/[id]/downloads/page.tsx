"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { retrospectiveOpen } from "@/domain/event";
import { photosAvailableUntil } from "@/domain/retention";
import { download, guestsCsv, zipAlbum } from "@/features/admin/export";
import { guestRanking } from "@/features/admin/service";
import { useAdmin } from "@/features/admin/context";
import { formatDate } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { copyFor } from "@/features/app/copy";
import { plural } from "@/lib/plural";
import { backendMode } from "@/lib/supabase/env";
import { PainelDownloads } from "@/revela/screens/PainelDownloads";

/** Downloads (17h): álbum em ZIP, lista de convidados em CSV e a retrospectiva. */
export default function Downloads() {
  const router = useRouter();
  const { repos } = useApp();
  const { event, now, photos, participants } = useAdmin();
  const [progress, setProgress] = useState<{ done: number; total: number } | undefined>();
  const [result, setResult] = useState<string | undefined>();
  const [error, setError] = useState<string>();
  const [csvBusy, setCsvBusy] = useState(false);
  const count = photos.filter((p) => p.status !== "removida").length;
  const people = participants.filter((p) => p.userId !== event.hostId).length;
  const until = photosAvailableUntil(event);

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

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : undefined;
  return (
    <PainelDownloads
      zip={{ desc: `${count} ${plural(count, "foto", "fotos")} · originais com filme`, pct, progressText: progress ? `Preparando… ${pct}% (${progress.done} de ${progress.total})` : undefined, disabled: count === 0 }}
      csv={{ desc: `${people} ${plural(people, "pessoa", "pessoas")} · nome, mesa, fotos tiradas`, disabled: csvBusy }}
      retro={retrospectiveOpen(event, now, false) && count > 0 ? { desc: "Disponível agora", href: `/e/${event.code}/retrospectiva` } : { desc: "Disponível depois da revelação" }}
      message={error ? { text: error, error: true } : result ? { text: result } : undefined}
      note={until !== null ? `As fotos ficam disponíveis até ${formatDate(until)}. ${copyFor(backendMode()).downloadsNote}` : copyFor(backendMode()).downloadsNote}
      onBack={() => router.push(`/painel/${event.id}`)}
      onZip={() => void album()}
      onCsv={() => void csv()}
    />
  );
}
