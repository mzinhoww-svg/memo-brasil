"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Abertura, Button, GoogleButton, Icon, KnownPeople, Logo } from "@/components/revela";
import { useApp } from "@/features/app/provider";
import { BackendNotice } from "@/features/app/backend-notice";
import { safeNextPath } from "@/features/auth/safe-next";

/** Retorno do OAuth com falha (`/?erro=login`, vindo de auth/callback): aviso dispensável no topo. */
function LoginErrorBanner() {
  const search = useSearchParams();
  const failed = search.get("erro") === "login";
  const next = safeNextPath(search.get("next"));
  const { signInWithGoogle } = useApp();
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function retry() {
    if (busy) return;
    setBusy(true);
    try { await signInWithGoogle(next); } catch { /* mantém o aviso e a nova tentativa */ }
    finally { setBusy(false); }
  }
  if (!failed || closed) return null;
  return (
    <div className="app-banner" role="alert" style={{ color: "var(--danger)", fontWeight: 600, justifyContent: "space-between" }}>
      <span style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <Icon name="sem-sinal" decorative size={22} />
        <span className="app-stack-sm">
          <span>Não conseguimos entrar com o Google. Tente de novo.</span>
          <Button small onClick={() => void retry()} disabled={busy} aria-busy={busy}>{busy ? "Entrando com o Google…" : "Tentar novamente com o Google"}</Button>
          <Link href="/ajuda" className="rv-link">Ajuda para entrar</Link>
        </span>
      </span>
      <button type="button" className="rv-btn rv-btn--texto" aria-label="Fechar aviso" onClick={() => setClosed(true)} style={{ minWidth: 44, minHeight: 44 }}>
        <Icon name="fechar" decorative size={20} />
      </button>
    </div>
  );
}

/** Abertura (00/01): vídeo de fundo, a promessa em uma frase e a entrada do anfitrião. O convidado entra pelo QR, não por aqui. */
export default function Home() {
  const { ready, user, persistent, storageError, known, switchTo, canSwitchIdentity, backend, canCreate, signInWithGoogle } = useApp();
  const cloud = backend === "supabase";
  const host = ready && (cloud ? canCreate : true);

  return (
    <main>
      <Abertura>
        <header className="rv-abertura__top">
          <Link href="/" aria-label="Revela, início"><Logo variant="lockup" size={120} /></Link>
          <Link href="/entrar#codigo" className="rv-link"><Icon name="qr" decorative size={20} />Tenho um convite</Link>
        </header>
        <Suspense fallback={null}><LoginErrorBanner /></Suspense>
        <div className="app-stack-sm">
          <h1 className="display-xl app-h1" style={{ fontSize: 44, lineHeight: "46px" }}>Cada convidado é uma câmera.</h1>
          <p className="corpo app-muted" style={{ margin: 0 }}>Monte a câmera do evento, espalhe o QR pela festa e veja tudo revelado no dia seguinte.</p>
        </div>
        <div className="app-stack-sm">
          {host && user ? (
            <>
              <Button href="/criar" variant="papel" block icon="camera">Montar câmera</Button>
              <Button href="/eventos" variant="secundario" block>Minhas câmeras</Button>
            </>
          ) : cloud ? (
            <>
              <GoogleButton block label="Continuar com Google" onClick={() => void signInWithGoogle("/criar")} />
              <Button href="/entrar" variant="secundario" block icon="email">Receber link por e-mail</Button>
            </>
          ) : (
            <Button href="/criar" variant="papel" block icon="camera">Montar câmera</Button>
          )}
          <Button href="/exemplo" variant="texto" block>Experimentar câmera</Button>
        </div>
        {ready && canSwitchIdentity && <KnownPeople people={known.filter((k) => k.id !== user?.id)} onPick={(id) => void switchTo(id)} />}
        {(!persistent || storageError) && ready && (
          <div className="app-banner" role="status">
            <Icon name="sem-sinal" label="Aviso" />
            <span>Este navegador não deixa guardar dados. O que você fizer some ao fechar a página.</span>
          </div>
        )}
        <BackendNotice localText="Versão local: eventos e fotos ficam guardados só neste aparelho. A colaboração entre aparelhos chega com o servidor." />
        <p className="rv-caption" style={{ textAlign: "center" }}>Ao continuar, você aceita os <Link href="/termos" className="rv-link">Termos</Link> e a <Link href="/privacidade" className="rv-link">Privacidade</Link>.</p>
      </Abertura>
    </main>
  );
}
