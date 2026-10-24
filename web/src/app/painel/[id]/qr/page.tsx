"use client";

import { useEffect, useState } from "react";
import { Button, Stepper, TableCard } from "@/components/memoriesmt";
import { useAdmin } from "@/features/admin/context";
import { useApp } from "@/features/app/provider";
import { updateSettings } from "@/features/events/service";
import { InviteA5 } from "@/features/invitations/InviteA5";
import { inviteUrl } from "@/features/invitations/links";
import { qrDataUrl } from "@/features/invitations/qr";
import { qrRollLine } from "@/features/studio/qr-copy";
import { qrDarkColor } from "@/lib/event-theme/spec";
import { siteOrigin } from "@/lib/site";

export default function QrStudio() {
  const { repos } = useApp();
  const { event, refresh, now } = useAdmin();
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const rollLine = qrRollLine(event);
  const labels = Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const l of labels) out[l] = await qrDataUrl(inviteUrl(siteOrigin(), event.code, l), 336, qrDarkColor(event.theme));
      if (alive) setQrs(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.code, event.tables]);

  function printTables() {
    document.body.dataset.imprimir = "mesas";
    const done = () => { delete document.body.dataset.imprimir; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <>
      <div className="no-print app-stack-sm">
        <p className="eyebrow app-eyebrow">Cada QR sabe de onde veio.</p>
        <h1 className="titulo-pagina app-h1">QR Code Studio</h1>
        <p className="app-p app-muted">Código da festa: <strong>{event.code}</strong>. Os QR levam a {siteOrigin().replace("https://", "")}, o endereço oficial.</p>
      </div>
      <InviteA5 event={event} now={now} />
      <section className="app-stack-sm convite-mesas" aria-labelledby="mesas-titulo">
        <div className="no-print app-stack-sm">
          <h2 id="mesas-titulo" className="titulo-card app-h1">Cards das mesas (A6)</h2>
          <p className="app-p app-muted">Um card por mesa: o QR diz de qual mesa veio a foto.</p>
          <Stepper label="Mesas" value={event.tables} min={0} max={60} decrementLabel="Menos uma mesa" incrementLabel="Mais uma mesa" format={(n) => String(n)} onChange={async (n) => { await updateSettings(repos, event.id, { tables: n }); await refresh(); }} />
          {event.tables > 0 && <div className="app-row"><Button variant="secundario" small onClick={printTables}>Imprimir cards das mesas</Button></div>}
        </div>
        <div className="app-qr-grid">
          {labels.map((l) => (qrs[l] ? <TableCard key={l} eyebrow={l} qrSrc={qrs[l]} eventName={event.title} title="Queremos a festa pelos seus olhos." steps="Aponte a câmera. Sem baixar app." note={rollLine} /> : null))}
        </div>
      </section>
    </>
  );
}
