"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Cover, Icon, KnownPeople, LiveIndicator, Signature, ThemeToggle, Logo } from "@/components/memoriesmt";
import type { MemoEvent } from "@/domain/event";
import { eventStatus } from "@/domain/event";
import { formatDate } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { BackendNotice } from "@/features/app/backend-notice";

/** Retorno do OAuth com falha (`/?erro=login`, vindo de auth/callback): aviso dispensável no topo (tela E6). */
function LoginErrorBanner() {
  const failed = useSearchParams().get("erro") === "login";
  const [closed, setClosed] = useState(false);
  if (!failed || closed) return null;
  return (
    <div className="app-banner" role="alert" style={{ color: "var(--rec-texto)", fontWeight: 600, justifyContent: "space-between", borderRadius: 0 }}>
      <span style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
        <Icon name="sem-sinal" decorative size={22} />
        <span>Não conseguimos entrar com o Google. Tente de novo.</span>
      </span>
      <button type="button" className="mm-btn mm-btn--texto" aria-label="Fechar aviso" onClick={() => setClosed(true)} style={{ minWidth: 44, minHeight: 44 }}>
        <Icon name="fechar" decorative size={20} />
      </button>
    </div>
  );
}

export default function Home() {
  const { repos, ready, user, now, persistent, storageError, known, switchTo, canSwitchIdentity } = useApp();
  const [mine, setMine] = useState<MemoEvent[]>([]);
  const [joined, setJoined] = useState<MemoEvent[]>([]);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    (async () => {
      const all = await repos.events.list();
      const memberships = await Promise.all(all.filter((e) => e.hostId !== user.id).map(async (e) => ((await repos.participants.get(e.id, user.id)) ? e : undefined)));
      if (!alive) return;
      setMine(all.filter((e) => e.hostId === user.id).sort((a, b) => b.createdAt - a.createdAt));
      setJoined(memberships.filter(Boolean) as MemoEvent[]);
    })();
    return () => {
      alive = false;
    };
  }, [repos, ready, user]);

  const row = (e: MemoEvent, host: boolean) => {
    const live = eventStatus(e, now()) === "ativo";
    return (
      <li key={e.id} className="app-card" style={{ listStyle: "none" }}>
        <div className="app-between">
          {live ? <LiveIndicator /> : <span className="eyebrow app-muted">Encerrado</span>}
          <span className="meta app-muted">{formatDate(e.startAt)}</span>
        </div>
        <span className="titulo-card">{e.title}</span>
        <div className="app-row">
          <Button variant="pequeno" href={`/e/${e.code}/agora`}>Ver no Agora</Button>
          {host && <Button variant="pequeno" href={`/painel/${e.id}`}>Painel</Button>}
        </div>
      </li>
    );
  };

  return (
    <main className="app-col app-col--card app-fluid">
      <Suspense fallback={null}><LoginErrorBanner /></Suspense>
      <div className="app-topbar">
        <Logo variant="wordmark" size={128} />
        <ThemeToggle />
      </div>
      <div className="app-landing-hero"><Cover /></div>
      <div className="app-screen">
        <div className="app-stack-sm">
          <h1 className="display app-h1" style={{ fontSize: 36 }}>A festa vista por todo mundo.</h1>
          <p className="corpo app-p app-muted">Todo mundo viu um casamento diferente. Agora dá para ver todos.</p>
        </div>
        <div className="app-stack-sm">
          <Button href="/entrar" variant="cta" icon="camera" block>Entrar na festa</Button>
          <Button href="/criar" variant="secundario" block>Criar evento</Button>
          <Button href="/exemplo" variant="texto">Ver como funciona</Button>
        </div>

        {ready && canSwitchIdentity && <KnownPeople people={known.filter((k) => k.id !== user?.id)} onPick={(id) => void switchTo(id)} />}

        {(!persistent || storageError) && ready && (
          <div className="app-banner" role="status">
            <Icon name="sem-sinal" label="Aviso" />
            <span>Este navegador não deixa guardar dados. O que você fizer some ao fechar a página.</span>
          </div>
        )}

        {mine.length > 0 && (
          <section className="app-stack-sm" aria-labelledby="meus">
            <h2 id="meus" className="titulo-card app-h1">Seus eventos</h2>
            <ul className="app-stack" style={{ padding: 0, margin: 0 }}>{mine.map((e) => row(e, true))}</ul>
          </section>
        )}
        {joined.length > 0 && (
          <section className="app-stack-sm" aria-labelledby="entrei">
            <h2 id="entrei" className="titulo-card app-h1">Festas em que você entrou</h2>
            <ul className="app-stack" style={{ padding: 0, margin: 0 }}>{joined.map((e) => row(e, false))}</ul>
          </section>
        )}

        <BackendNotice localText="Versão local: eventos e fotos ficam guardados só neste aparelho. A colaboração entre aparelhos chega com o servidor." />
        <div style={{ marginTop: "auto" }}><Signature /></div>
      </div>
    </main>
  );
}
