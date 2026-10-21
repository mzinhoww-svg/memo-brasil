"use client";

import { AppearanceStudio } from "@/features/studio/AppearanceStudio";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { restoreDefaultTheme, saveTheme } from "@/features/events/theme";
import { computeRevealStatus } from "@/domain/reveal";

const MOTIVO = { invalido: "Tema inválido: confira as cores.", bloqueado: "A revelação já aconteceu; não dá para mudar.", inexistente: "Evento não encontrado." } as const;

export default function Aparencia() {
  const { repos, now: clock } = useApp();
  const { event, now, refresh } = useAdmin();
  const locked = event.revealEnabled && computeRevealStatus(event, now) === "revelada";
  return (
    <AppearanceStudio
      key={event.version}
      event={event}
      locked={locked}
      onSave={async (t) => { const r = await saveTheme(repos, event.id, t, clock()); await refresh(); return r.ok ? undefined : MOTIVO[r.reason]; }}
      onRestore={async () => { const r = await restoreDefaultTheme(repos, event.id, clock()); await refresh(); return r.ok ? undefined : MOTIVO[r.reason]; }}
    />
  );
}
