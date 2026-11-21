"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button, Icon, KnownPeople } from "@/components/revela";
import { AberturaSplash } from "@/revela/screens/AberturaSplash";
import { Main } from "@/revela/screens/Main";
import { useApp } from "@/features/app/provider";
import { BackendNotice } from "@/features/app/backend-notice";
import { safeNextPath } from "@/features/auth/safe-next";
import { emailLoginEnabled } from "@/features/auth/email-login";
import { AccountMenu } from "@/features/auth/AccountMenu";

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

const SPLASH_KEY = "mm-abertura";
export const CTA = "Criar a câmera do meu evento";

/** true depois que o fim do topo saiu da tela para cima (rolou para as seções de texto). */
function usePastElement(ref: RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return past;
}

/** Botão fixo no rodapé do celular (some no computador pelo CSS), visível depois que o topo sai da tela. */
function StickyCta({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className="home-sticky" data-show={show ? "1" : "0"} aria-hidden={!show} inert={!show || undefined} data-testid="cta-fixo">{children}</div>;
}

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

/** Topo da home (00/01): vídeo de fundo, a promessa em uma frase e a entrada do anfitrião. O convidado entra pelo QR, não por aqui. */
export function HomeHero() {
  const { ready, user, persistent, storageError, known, switchTo, canSwitchIdentity, backend, canCreate, signInWithGoogle } = useApp();
  const cloud = backend === "supabase";
  const host = ready && (cloud ? canCreate : true);
  const splash = useSplash();
  const heroEnd = useRef<HTMLDivElement>(null);
  const pastHero = usePastElement(heroEnd);

  const go = () => void signInWithGoogle("/criar");
  // um botão só (item 6): leva a /criar; sem sessão na nuvem, o mesmo botão abre o login do Google e volta para /criar
  const cta = host && user || !cloud
    ? <Link href="/criar" className="rv-btn rv-btn--block rv-btn--paper"><Icon name="camera" decorative size={20} />{CTA}</Link>
    : <button type="button" className="rv-btn rv-btn--block rv-btn--paper" onClick={go}><Icon name="camera" decorative size={20} />{CTA}</button>;
  const actions = (
    <>
      {cta}
      {host && user ? (
        <Link href="/eventos" className="rv-link center">Minhas câmeras</Link>
      ) : cloud ? (
        <p className="rv-caption center">Você entra com a sua conta Google.{emailLoginEnabled() && <> Ou <Link href="/entrar" className="link">receba um link por e-mail</Link>.</>}</p>
      ) : null}
    </>
  );

  return (
    <main>
      <Main
        title={<>A câmera dos convidados{" "}<br />para o seu evento.</>}
        lead="Grátis para começar. Os convidados fotografam pelo celular, sem baixar nada."
        account={host && user && cloud ? <AccountMenu /> : undefined}
        hideLegal={Boolean(host && user && cloud)}
        banner={<Suspense fallback={null}><LoginErrorBanner /></Suspense>}
        actions={actions}
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
      <div ref={heroEnd} aria-hidden="true" />
      <StickyCta show={pastHero}>{host && user || !cloud
        ? <Link href="/criar" className="rv-btn rv-btn--block rv-btn--primary">{CTA}</Link>
        : <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={go}>{CTA}</button>}</StickyCta>
      {splash && <div className="rv-splash" aria-hidden="true"><AberturaSplash /></div>}
    </main>
  );
}
