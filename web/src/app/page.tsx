"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Cover, Icon, type IconName, KnownPeople, Signature, Logo } from "@/components/revela";
import { useApp } from "@/features/app/provider";
import { LivePricingLine } from "@/features/marketing/PricingLine";
import { BackendNotice } from "@/features/app/backend-notice";
import { safeNextPath } from "@/features/auth/safe-next";

const STEPS: { icon: IconName; text: string }[] = [
  { icon: "explorar", text: "Aponta para o QR da mesa" },
  { icon: "camera", text: "Cada um tem seu rolo" },
  { icon: "agora", text: "Tudo revela junto" },
];

/** Retorno do OAuth com falha (`/?erro=login`, vindo de auth/callback): aviso dispensável no topo (tela E6). */
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
    <div className="app-banner" role="alert" style={{ color: "var(--danger)", fontWeight: 600, justifyContent: "space-between", borderRadius: 0 }}>
      <span style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <Icon name="sem-sinal" decorative size={22} />
        <span className="app-stack-sm">
          <span>Não conseguimos entrar com o Google. Tente de novo.</span>
          <Button onClick={() => void retry()} disabled={busy} aria-busy={busy}>{busy ? "Entrando com o Google…" : "Tentar novamente com o Google"}</Button>
          <Link href="/ajuda" className="rv-link">Ajuda para entrar</Link>
        </span>
      </span>
      <button type="button" className="rv-btn rv-btn--texto" aria-label="Fechar aviso" onClick={() => setClosed(true)} style={{ minWidth: 44, minHeight: 44 }}>
        <Icon name="fechar" decorative size={20} />
      </button>
    </div>
  );
}

export default function Home() {
  const { ready, user, persistent, storageError, known, switchTo, canSwitchIdentity } = useApp();

  return (
    <main className="app-col app-col--card app-fluid">
      <Suspense fallback={null}><LoginErrorBanner /></Suspense>
      <div className="app-topbar">
        <Logo variant="wordmark" size={128} />
        <div className="app-row" style={{ alignItems: "center" }}>
          {ready && user && <Link href="/eventos" className="rv-link app-topbar-link">Meus eventos</Link>}
        </div>
      </div>
      <div className="app-landing-hero"><Cover /></div>
      <div className="app-screen">
        <div className="app-stack-sm">
          <p className="eyebrow app-eyebrow">CÂMERA DESCARTÁVEL COLETIVA</p>
          <h1 className="display app-h1" style={{ fontSize: 36 }}>Seu evento pelo olhar de cada convidado.</h1>
          <p className="corpo app-p app-muted">Sem baixar app. As fotos ficam no escuro e aparecem juntas, na hora que você escolher.</p>
        </div>
        <ol className="app-passos" aria-label="Como funciona">
          {STEPS.map((st) => (
            <li key={st.text}>
              <Icon name={st.icon} decorative size={24} />
              <span>{st.text}</span>
            </li>
          ))}
        </ol>
        <section className="app-demo" aria-labelledby="demo-titulo">
          <div className="app-demo-linha">
            <span className="app-demo-icone" aria-hidden="true"><Icon name="play" decorative size={24} /></span>
            <span className="app-stack-sm" style={{ gap: 2 }}>
              <h2 id="demo-titulo" className="titulo-card" style={{ margin: 0 }}>Experimente a câmera agora</h2>
              <span className="meta app-muted">Festa de exemplo · sem cadastro · nada é salvo</span>
            </span>
          </div>
          <Button href="/exemplo" variant="secundario" icon="camera" block>Experimentar câmera</Button>
        </section>
        <div className="app-stack-sm">
          <Button href="/criar" variant="cta" block>Criar meu evento grátis</Button>
          <Button href="/entrar" variant="texto">Entrar com código</Button>
          <LivePricingLine />
        </div>

        {ready && canSwitchIdentity && <KnownPeople people={known.filter((k) => k.id !== user?.id)} onPick={(id) => void switchTo(id)} />}

        {(!persistent || storageError) && ready && (
          <div className="app-banner" role="status">
            <Icon name="sem-sinal" label="Aviso" />
            <span>Este navegador não deixa guardar dados. O que você fizer some ao fechar a página.</span>
          </div>
        )}

        <BackendNotice localText="Versão local: eventos e fotos ficam guardados só neste aparelho. A colaboração entre aparelhos chega com o servidor." />
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}
