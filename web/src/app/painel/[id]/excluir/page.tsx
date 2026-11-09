"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSheet } from "@/components/revela";
import { eventStatus } from "@/domain/event";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { deleteEvent, endEventNow } from "@/features/events/service";
import { PainelExcluir } from "@/revela/screens/PainelExcluir";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Excluir evento (17j): só apaga depois de digitar o nome do evento; a saída suave é encerrar o filme sem excluir. */
export default function Excluir() {
  const router = useRouter();
  const { repos, now: clock, scheduler } = useApp();
  const { event, now, photos, refresh } = useAdmin();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [ending, setEnding] = useState(false);
  const count = photos.filter((p) => p.status !== "removida").length;
  const ended = eventStatus(event, now) === "encerrado";

  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      await deleteEvent(repos, event.id);
      scheduler.cancel(event.id);
      router.push("/eventos");
    } catch {
      setError("Não foi possível excluir. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <>
      <PainelExcluir
        name={event.title} photos={count} value={value} enabled={norm(value) === norm(event.title)} canEnd={!ended} busy={busy} error={error}
        onValue={setValue} onDelete={() => void remove()} onEnd={() => setEnding(true)}
        onBack={() => router.push(`/painel/${event.id}/configuracoes`)}
      />
      {ending && (
        <ConfirmSheet title="Encerrar agora?" body="Ninguém posta mais. As fotos continuam no álbum." confirmLabel="Encerrar agora" onCancel={() => setEnding(false)}
          onConfirm={async () => {
            const updated = await endEventNow(repos, event.id, clock());
            if (!updated) throw new Error("Evento indisponível");
            scheduler.cancel(event.id);
            await refresh();
            router.push(`/painel/${event.id}`);
          }} />
      )}
    </>
  );
}
