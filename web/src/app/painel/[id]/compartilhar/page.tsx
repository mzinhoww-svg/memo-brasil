"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { useAdmin } from "@/features/admin/context";
import { qrMatrix } from "@/features/invitations/invite-pdf";
import { inviteUrl } from "@/features/invitations/links";
import { copyText, shareInvite } from "@/features/invitations/share";
import { siteOrigin } from "@/lib/site";
import { QRCompartilhar } from "@/revela/screens/QRCompartilhar";
import { QrSvg, useFlash } from "@/revela/painel-ui";

/** Compartilhar (26): link do evento, WhatsApp, Stories, QR na tela e impressão. */
export default function Compartilhar() {
  const router = useRouter();
  const { event } = useAdmin();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [toast, flash] = useFlash();
  const origin = siteOrigin();
  const url = inviteUrl(origin, event.code);
  const modules = useMemo(() => qrMatrix(inviteUrl(siteOrigin(), event.code)), [event.code]);
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
        onPrint={() => router.push(`/painel/${event.id}/convite`)}
      />
      {toast}
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
