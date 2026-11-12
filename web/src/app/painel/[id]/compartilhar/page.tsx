"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { useAdmin } from "@/features/admin/context";
import dynamic from "next/dynamic";
import { qrMatrix } from "@/features/invitations/qr-export";
import { inviteUrl } from "@/features/invitations/links";
import { copyText, shareInvite } from "@/features/invitations/share";
import { siteOrigin } from "@/lib/site";
import { QRCompartilhar } from "@/revela/screens/QRCompartilhar";
import { QrSvg, useFlash } from "@/revela/painel-ui";

// a folha de download (PDF/PNG do QR) só abre no toque: fora do bundle da página
const QrDownloadSheet = dynamic(() => import("@/features/invitations/QrDownload").then((m) => m.QrDownloadSheet), { ssr: false });

/** Compartilhar (26): link do evento, WhatsApp, Stories, QR na tela e download do QR code. */
export default function Compartilhar() {
  const router = useRouter();
  const { event } = useAdmin();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, flash] = useFlash();
  const origin = siteOrigin();
  const url = inviteUrl(origin, event.code);
  const modules = useMemo(() => qrMatrix(inviteUrl(siteOrigin(), event.code)), [event.code]);
  const tables = useMemo(() => Array.from({ length: event.tables }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`), [event.tables]);
  const text = `Você foi convidado para "${event.title}" no Revela. Entre com o código ${event.code} ou pelo link: ${url}`;

  async function copy() {
    if (await copyText(url)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else flash("Não conseguimos copiar. Selecione o link e copie.");
  }
  async function stories() {
    const r = await shareInvite(event, origin);
    if (r === "copiado") flash("Convite copiado. Cole nos Stories.");
    else if (r === "falhou") flash("Não conseguimos compartilhar agora.");
  }

  return (
    <>
      <QRCompartilhar
        cam={`/revela/3d/cam-${event.cameraStyle}-960.webp`}
        link={`${origin.replace(/^https?:\/\//, "")}/e/${event.code}`} copied={copied}
        onClose={() => router.push(`/painel/${event.id}`)}
        onCopy={() => void copy()}
        onWhatsapp={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")}
        onStories={() => void stories()}
        onQr={() => setShowQr(true)}
        onDownload={() => setDownloading(true)}
      />
      {toast}
      {downloading && <QrDownloadSheet title={event.title} code={event.code} origin={origin} tables={tables} onClose={() => setDownloading(false)} />}
      {showQr && (
        <Sheet title="QR do evento" onClose={() => setShowQr(false)}>
          <div style={{ display: "grid", placeItems: "center" }}><QrSvg size={256} modules={modules} /></div>
          <p className="app-p app-muted">Código do evento: <strong>{event.code}</strong></p>
          <Button variant="secundario" block onClick={() => setShowQr(false)}>Fechar</Button>
        </Sheet>
      )}
    </>
  );
}
