"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Icon, KnownPeople } from "@/components/revela";
import { AberturaSplash } from "@/revela/screens/AberturaSplash";
import { Main } from "@/revela/screens/Main";
import { useApp } from "@/features/app/provider";
import { BackendNotice } from "@/features/app/backend-notice";
import { safeNextPath } from "@/features/auth/safe-next";
import { emailLoginEnabled } from "@/features/auth/email-login";

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

const GOOGLE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.6-1.6 2.6-3.8 2.6-6.5z" />
    <path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z" />
    <path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8z" />
    <path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
  </svg>
);
const SPLASH_KEY = "mm-abertura";

/** 00 · Splash: só ao abrir o app instalado (tela cheia), uma vez por sessão e sem "reduzir movimento". No navegador vai direto à 01. */
function useSplash(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (sessionStorage.getItem(SPLASH_KEY)) return;
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch { return; }
    const on = setTimeout(() => setShow(true), 0);
    const off = setTimeout(() => setShow(false), 1400);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, []);
  return show;
}

/** Abertura (00/01): vídeo de fundo, a promessa em uma frase e a entrada do anfitrião. O convidado entra pelo QR, não por aqui. */
export default function Home() {
  const { ready, user, persistent, storageError, known, switchTo, canSwitchIdentity, backend, canCreate, signInWithGoogle } = useApp();
  const cloud = backend === "supabase";
  const host = ready && (cloud ? canCreate : true);
  const splash = useSplash();

  const actions = host && user ? (
    <>
      <Link href="/criar" className="rv-btn rv-btn--block rv-btn--paper"><Icon name="camera" decorative size={20} />Montar câmera</Link>
      <Link href="/eventos" className="rv-btn rv-btn--block rv-btn--line">Minhas câmeras</Link>
    </>
  ) : cloud ? (
    <>
      <button type="button" className="rv-btn rv-btn--block rv-btn--paper" onClick={() => void signInWithGoogle("/criar")}>{GOOGLE}Continuar com Google</button>
      {emailLoginEnabled() && <Link href="/entrar" className="rv-btn rv-btn--block rv-btn--line"><Icon name="email" decorative size={20} />Receber link por e-mail</Link>}
    </>
  ) : (
    <Link href="/criar" className="rv-btn rv-btn--block rv-btn--paper"><Icon name="camera" decorative size={20} />Montar câmera</Link>
  );

  return (
    <main>
      <Main
        banner={<Suspense fallback={null}><LoginErrorBanner /></Suspense>}
        actions={<>{actions}<Link href="/exemplo" className="rv-btn rv-btn--block rv-btn--text">Experimentar câmera</Link></>}
        extra={<>
          {ready && canSwitchIdentity && <KnownPeople people={known.filter((k) => k.id !== user?.id)} onPick={(id) => void switchTo(id)} />}
          {(!persistent || storageError) && ready && (
            <div className="app-banner" role="status">
              <Icon name="sem-sinal" label="Aviso" />
              <span>Este navegador não deixa guardar dados. O que você fizer some ao fechar a página.</span>
            </div>
          )}
          <BackendNotice localText="Versão local: eventos e fotos ficam guardados só neste aparelho. A colaboração entre aparelhos chega com o servidor." />
        </>}
      />
      {splash && <div className="rv-splash" aria-hidden="true"><AberturaSplash /></div>}
    </main>
  );
}
