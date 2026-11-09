"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TableCard } from "@/components/revela";
import type { MemoEvent } from "@/domain/event";
import { useAdmin } from "@/features/admin/context";
import { revealStamp } from "@/features/admin/panel-format";
import { inviteUrl } from "@/features/invitations/links";
import { qrMatrix } from "@/features/invitations/invite-pdf";
import { qrDataUrl } from "@/features/invitations/qr";
import { qrRollLine } from "@/features/studio/qr-copy";
import { qrDarkColor } from "@/lib/event-theme/spec";
import { siteOrigin } from "@/lib/site";
import { QRConvite } from "@/revela/screens/QRConvite";

const CATEGORY_NOUN: Record<MemoEvent["category"], string> = { casamento: "casamento", festa: "festa", empresa: "evento", viagem: "viagem", outro: "evento" };
const poses = (e: MemoEvent) => (e.shotsPerPerson === null ? "poses sem limite" : `${e.shotsPerPerson} poses`);

/** Quatro redações do cartão de mesa; a 2ª é a do desenho. */
const MODELS: ((e: MemoEvent) => string)[] = [
  (e) => `Escaneie o código, entre com o seu nome e fotografe a festa. Você tem ${poses(e)}.`,
  (e) => `Aponte a câmera do celular para o código, pegue a câmera do ${CATEGORY_NOUN[e.category]} e fotografe a festa pelo seu olhar. Você tem ${poses(e)}.`,
  (e) => `Aqui a festa vira filme. Aponte o celular para o código e use ${e.shotsPerPerson === null ? "quantas poses quiser" : `as suas ${poses(e)}`}.`,
  () => "Sem baixar aplicativo: aponte a câmera para o código e comece a fotografar.",
];

const longDate = (ts: number, tz: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(new Date(ts));

/** QR para as mesas (25): o cartão de mesa em quatro modelos e a impressão de um cartão por mesa (cada QR sabe de onde veio). */
export default function QrMesas() {
  const router = useRouter();
  const { event, now } = useAdmin();
  const [model, setModel] = useState(2);
  const [square, setSquare] = useState(false);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const labels = useMemo(() => (event.tables > 0 ? Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`) : []), [event.tables]);
  const copy = MODELS[model - 1](event);
  const qr = useMemo(() => qrMatrix(inviteUrl(siteOrigin(), event.code)), [event.code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const l of labels.length ? labels : [""]) out[l] = await qrDataUrl(inviteUrl(siteOrigin(), event.code, l || undefined), 336, qrDarkColor(event.theme));
      if (alive) setQrs(out);
    })();
    return () => { alive = false; };
  }, [event.code, event.theme, labels]);

  function print() {
    document.body.dataset.imprimir = "mesas";
    const done = () => { delete document.body.dataset.imprimir; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <>
      <h1 className="rv-sr-only">QR para as mesas</h1>
      <QRConvite
        name={event.title} date={longDate(event.startAt, event.timezone)} copy={copy} stamp={revealStamp(event, now)}
        model={model} models={MODELS.length} qr={qr} square={square}
        onClose={() => router.push(`/painel/${event.id}/convites`)}
        onRatio={() => setSquare((v) => !v)} onModel={setModel} onPrint={print} onPdf={print}
      />
      <section className="print-only print-mesas convite-mesas" aria-hidden="true">
        <div className="app-qr-grid">
          {(labels.length ? labels : [""]).map((l) => (qrs[l] ? <TableCard key={l || "geral"} eyebrow={l || "Convidados"} qrSrc={qrs[l]} eventName={event.title} title={copy} steps="Aponte a câmera. Sem baixar app." note={qrRollLine(event)} /> : null))}
        </div>
      </section>
    </>
  );
}
