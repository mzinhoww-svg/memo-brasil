"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/features/admin/context";
import { printInvite } from "@/features/invitations/invite-print";
import dynamic from "next/dynamic";
import { qrMatrix } from "@/features/invitations/qr-export";
import { siteOrigin } from "@/lib/site";
import { PainelConviteA5 } from "@/revela/screens/PainelConviteA5";

// a folha de download (PDF/PNG do QR) só abre no toque: fora do bundle da página
const QrDownloadSheet = dynamic(() => import("@/features/invitations/QrDownload").then((m) => m.QrDownloadSheet), { ssr: false });

const longDate = (ts: number, tz: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "long", year: "numeric" }).format(new Date(ts));

/** Convite (17k): prévia do convite e download do QR code (SVG e PNG), para a arte ser montada fora da plataforma. */
export default function ConviteA5() {
  const router = useRouter();
  const { event, now } = useAdmin();
  const [downloading, setDownloading] = useState(false);
  const inv = useMemo(() => printInvite(event, now), [event, now]);
  const qr = useMemo(() => qrMatrix(inv.qrText), [inv.qrText]);
  const tables = useMemo(() => Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`), [event.tables]);
  const poses = event.shotsPerPerson === null ? "poses sem limite" : `${event.shotsPerPerson} ${"poses suas"}`;
  return (
    <>
      <PainelConviteA5
        name={inv.title} date={longDate(event.startAt, event.timezone)}
        steps={["1 · Aponte a câmera", "2 · Escreva seu nome", `3 · ${poses}`]}
        code={inv.code} footer={inv.reveal} qr={qr}
        onBack={() => router.push(`/painel/${event.id}/convites`)}
        onDownload={() => setDownloading(true)}
      />
      {downloading && <QrDownloadSheet title={event.title} code={event.code} origin={siteOrigin()} tables={tables} onClose={() => setDownloading(false)} />}
    </>
  );
}
