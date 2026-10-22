"use client";

import { useEffect, useState } from "react";
import { Button, Stepper, TableCard } from "@/components/memoriesmt";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";
import { inviteUrl } from "@/features/invitations/links";
import { qrDataUrl } from "@/features/invitations/qr";
import { qrRollLine } from "@/features/studio/qr-copy";
import { qrDarkColor } from "@/lib/event-theme/spec";

export default function QrStudio() {
  const { repos } = useApp();
  const { event, refresh } = useAdmin();
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const rollLine = qrRollLine(event);
  const labels = ["Convite", ...Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`)];

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const l of labels) out[l] = await qrDataUrl(inviteUrl(window.location.origin, event.code, l === "Convite" ? undefined : l), 336, qrDarkColor(event.theme));
      if (alive) setQrs(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.code, event.tables]);

  return (
    <>
      <div className="no-print app-stack-sm">
        <p className="eyebrow app-eyebrow">Cada QR sabe de onde veio.</p>
        <h1 className="titulo-pagina app-h1">QR Code Studio</h1>
        <p className="app-p app-muted">Código da festa: <strong>{event.code}</strong>. Imprima um card por mesa em A6.</p>
        <Stepper label="Mesas" value={event.tables} min={0} max={60} decrementLabel="Menos uma mesa" incrementLabel="Mais uma mesa" format={(n) => String(n)} onChange={async (n) => { await updateSettings(repos, event.id, { tables: n }); await refresh(); }} />
        <div className="app-row"><Button variant="pequeno" onClick={() => window.print()}>Imprimir cards</Button></div>
      </div>
      <div className="app-qr-grid">
        {labels.map((l) => (qrs[l] ? <TableCard key={l} eyebrow={l} qrSrc={qrs[l]} eventName={event.title} title="Queremos a festa pelos seus olhos." steps="Aponte a câmera. Sem baixar app." note={rollLine} /> : null))}
      </div>
    </>
  );
}
