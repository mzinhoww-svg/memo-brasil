"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemoEvent } from "@/domain/event";
import { useAdmin } from "@/features/admin/context";
import { revealStamp } from "@/features/admin/panel-format";
import { inviteUrl } from "@/features/invitations/links";
import dynamic from "next/dynamic";
import { qrMatrix } from "@/features/invitations/qr-export";
import { siteOrigin } from "@/lib/site";
import { QRConvite } from "@/revela/screens/QRConvite";

// a folha de download (PDF/PNG do QR) só abre no toque: fora do bundle da página
const QrDownloadSheet = dynamic(() => import("@/features/invitations/QrDownload").then((m) => m.QrDownloadSheet), { ssr: false });

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

/** QR para as mesas (25): o cartão de mesa em quatro modelos (prévia) e o download do QR code, geral ou por mesa (cada QR sabe de onde veio). */
export default function QrMesas() {
  const router = useRouter();
  const { event, now } = useAdmin();
  const [model, setModel] = useState(2);
  const [square, setSquare] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const labels = useMemo(() => (event.tables > 0 ? Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`) : []), [event.tables]);
  const copies = useMemo(() => MODELS.map((m) => m(event)), [event]);
  const qr = useMemo(() => qrMatrix(inviteUrl(siteOrigin(), event.code)), [event.code]);

  return (
    <>
      <QRConvite
        name={event.title} date={longDate(event.startAt, event.timezone)} copy={copies[model - 1]} copies={copies} stamp={revealStamp(event, now)}
        model={model} models={MODELS.length} qr={qr} square={square}
        onClose={() => router.push(`/painel/${event.id}/convites`)}
        onRatio={() => setSquare((v) => !v)} onModel={setModel} onDownload={() => setDownloading(true)}
      />
      {downloading && <QrDownloadSheet title={event.title} code={event.code} origin={siteOrigin()} tables={labels} onClose={() => setDownloading(false)} />}
    </>
  );
}
