"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, EventHeader, EventTheme, Signature } from "@/components/memoriesmt";
import { formatDate, useEventData } from "@/features/app/hooks";
import { inviteUrl } from "@/features/invitations/links";
import { qrDataUrl } from "@/features/invitations/qr";
import { BackendNotice } from "@/features/app/backend-notice";
import { useBrandImages } from "@/features/studio/useBrandImages";

export default function Pronto() {
  const { id } = useParams<{ id: string }>();
  const { event, loading, error, refresh } = useEventData({ id });
  const [retrying, setRetrying] = useState(false);
  const [qr, setQr] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const brand = useBrandImages(event?.id);
  const link = event ? inviteUrl(window.location.origin, event.code) : "";

  useEffect(() => {
    if (link) void qrDataUrl(link).then(setQr);
  }, [link]);

  if (loading) return <main className="app-col" aria-busy="true"><p className="app-screen app-muted" role="status">Preparando o convite…</p></main>;
  if (!event && error) return (
    <main className="app-col app-fluid"><div className="app-screen">
      <h1 className="titulo-tela app-h1">Não deu para abrir o convite agora.</h1>
      <p className="app-p" role="alert">{error === "forbidden" ? "Esta conta não tem acesso ao evento. Entre com a conta Google que o criou." : "Não conseguimos carregar o evento. Confira sua conexão e tente novamente."}</p>
      <Button disabled={retrying} aria-busy={retrying} onClick={async () => { setRetrying(true); try { await refresh(); } catch { /* o aviso continua disponível para repetir */ } finally { setRetrying(false); } }} block>{retrying ? "Tentando novamente…" : "Tentar novamente"}</Button>
      <Button href="/eventos" variant="secundario" block>Meus eventos</Button>
    </div></main>
  );
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
    if (await copyText(text)) setCopied(true);
    else failCopy();
  }
  /** Copia de verdade ou avisa: nunca diz "copiado" sem ter copiado (UX-12). */
  async function copyText(value: string): Promise<boolean> {
    try {
      if (!navigator.clipboard) return false;
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
  function failCopy() {
    setCopyFailed(true);
    setLinkCopied(false);
    setCopied(false);
    linkInput.current?.focus();
    linkInput.current?.select();
  }

  return (
    <EventTheme palette={event.palette} font={event.eventFont} theme={event.theme} className="app-col app-col--card app-col--pronto app-fluid">
      <main style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <EventHeader meta={[formatDate(event.startAt), event.place].filter(Boolean).join(" · ")} name={event.title} {...brand} />
        <div className="app-screen">
          <p className="emocao app-emocao" role="status">Evento criado.</p>
          <div className="pronto-grid">
            <div className="app-card" style={{ alignItems: "center", textAlign: "center" }}>
              <span className="eyebrow app-muted">Código da festa</span>
              <span data-testid="codigo" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.12em" }}>{event.code}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="pronto-qr-caixa">{qr && <img className="pronto-qr" src={qr} alt={`QR Code do convite de ${event.title}`} width={240} height={240} />}</div>
            </div>
            <div className="app-stack">
              <div className="app-stack-sm">
                <label className="mm-field-label" htmlFor="link-convite">Link do convite</label>
                <div className="pronto-url">
                  <input ref={linkInput} id="link-convite" data-testid="link-convite" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="secundario" onClick={async () => { if (await copyText(link)) { setCopyFailed(false); setLinkCopied(true); } else failCopy(); }}>{linkCopied ? "Link copiado" : "Copiar link"}</Button>
                </div>
                <span className={copyFailed ? "app-banner" : "app-muted"} aria-live="polite" role={copyFailed ? "alert" : undefined} style={copyFailed ? undefined : { fontSize: 13 }}>
                  {linkCopied ? "Link copiado para a área de transferência." : copyFailed ? "Não conseguimos copiar. O link está selecionado." : ""}
                </span>
              </div>
              <div className="app-stack-sm">
                <Button block onClick={share}>{copied ? "Convite copiado" : "Compartilhar convite"}</Button>
                <Button variant="secundario" block href={`/e/${event.code}`}>Entrar como convidado</Button>
                <Button variant="secundario" block href={`/painel/${event.id}`}>Abrir o painel</Button>
              </div>
            </div>
          </div>
          <BackendNotice localText="Versão local: o convite só abre neste aparelho. Para outros aparelhos entrarem, o servidor precisa estar ligado." />
          <div style={{ marginTop: "auto" }}><Signature /></div>
        </div>
      </main>
    </EventTheme>
  );
}
