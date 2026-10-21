"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, EventHeader, EventTheme, Signature } from "@/components/memoriesmt";
import { formatDate, useEventData } from "@/features/app/hooks";
import { inviteUrl } from "@/features/invitations/links";
import { qrDataUrl } from "@/features/invitations/qr";
import { BackendNotice } from "@/features/app/backend-notice";

export default function Pronto() {
  const { id } = useParams<{ id: string }>();
  const { event, loading } = useEventData({ id });
  const [qr, setQr] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const link = event ? inviteUrl(window.location.origin, event.code) : "";

  useEffect(() => {
    if (link) void qrDataUrl(link).then(setQr);
  }, [link]);

  if (loading) return <main className="app-col"><p className="app-screen app-muted">Preparando o convite…</p></main>;
  if (!event) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Não achamos esse evento.</h1><Button href="/" block>Voltar ao início</Button></div></main>;

  const text = `Você foi convidado para "${event.title}" no MemoriesMT. Entre com o código ${event.code} ou pelo link: ${link}`;
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: event!.title, text });
        return;
      } catch {
        /* cancelado: cai para copiar */
      }
    }
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
  }

  return (
    <EventTheme palette={event.palette} font={event.eventFont} theme={event.theme} className="app-col app-col--card app-fluid">
      <main style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <EventHeader meta={[formatDate(event.startAt), event.place].filter(Boolean).join(" · ")} name={event.title} />
        <div className="app-screen">
          <p className="emocao app-emocao">Evento criado.</p>
          <div className="app-card">
            <span className="eyebrow app-muted">Código da festa</span>
            <span data-testid="codigo" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.12em" }}>{event.code}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt={`QR Code do convite de ${event.title}`} width={168} height={168} style={{ borderRadius: "var(--radius-md)" }} />}
            <span className="meta app-muted" style={{ wordBreak: "break-all" }}>{link}</span>
          </div>
          <div className="app-stack-sm">
            <Button block onClick={share}>{copied ? "Convite copiado" : "Compartilhar convite"}</Button>
            <Button variant="secundario" block href={`/e/${event.code}`}>Entrar como convidado</Button>
            <Button variant="secundario" block href={`/painel/${event.id}`}>Abrir o painel</Button>
          </div>
          <BackendNotice localText="Versão local: o convite só abre neste aparelho. Para outros aparelhos entrarem, o servidor precisa estar ligado." />
          <div style={{ marginTop: "auto" }}><Signature /></div>
        </div>
      </main>
    </EventTheme>
  );
}
