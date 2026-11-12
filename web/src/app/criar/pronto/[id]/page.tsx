"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ScreenSkeleton } from "@/components/revela";
import { CameraPronta } from "@/revela/screens/CameraPronta";
import { useEventData } from "@/features/app/hooks";
import { inviteUrl } from "@/features/invitations/links";

export default function Pronto() {
  const { id } = useParams<{ id: string }>();
  const { event, loading, error, refresh } = useEventData({ id });
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const link = event ? inviteUrl(window.location.origin, event.code) : "";

  if (loading) return <main className="app-col"><ScreenSkeleton variant="lista" label="Preparando o convite…" /></main>;
  if (!event && error) return (
    <main className="app-col app-fluid"><div className="app-screen">
      <h1 className="titulo-tela app-h1">Não deu para abrir o convite agora.</h1>
      <p className="app-p" role="alert">{error === "forbidden" ? "Esta conta não tem acesso ao evento. Entre com a conta Google que o criou." : "Não conseguimos carregar o evento. Confira sua conexão e tente novamente."}</p>
      <Button disabled={retrying} aria-busy={retrying} onClick={async () => { setRetrying(true); try { await refresh(); } catch { /* o aviso continua disponível para repetir */ } finally { setRetrying(false); } }} block>{retrying ? "Tentando novamente…" : "Tentar novamente"}</Button>
      <Button href="/eventos" variant="secundario" block>Meus eventos</Button>
    </div></main>
  );
  if (!event) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Não achamos esse evento.</h1><Button href="/" block>Voltar ao início</Button></div></main>;

  const text = `Você foi convidado para "${event.title}" no Revela. Entre com o código ${event.code} ou pelo link: ${link}`;
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
    setCopied(false);
    linkInput.current?.focus();
    linkInput.current?.select();
  }

  return (
    <>
      <CameraPronta name={event.title} cam={`/revela/3d/cam-${event.cameraStyle}-960.webp`} shareLabel={copied ? "Convite copiado" : "Compartilhar convite"} printHref={`/painel/${event.id}/qr`} onShare={() => void share()} />
      {/* leitura por teste/automação e foco de cópia quando a área de transferência falha; fora da vista */}
      <div className="rv-sr-only">
        <span data-testid="codigo">{event.code}</span>
        <input ref={linkInput} data-testid="link-convite" aria-label="Link do convite" readOnly value={link} />
        {copyFailed && <span role="alert">Não conseguimos copiar. O link está selecionado.</span>}
      </div>
    </>
  );
}
