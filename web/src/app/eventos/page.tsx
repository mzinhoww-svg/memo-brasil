"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, GoogleButton, LiveIndicator, Logo, Skeleton } from "@/components/revela";
import { eventStatus, type MemoEvent } from "@/domain/event";
import { formatDate } from "@/features/app/hooks";
import { loadMyEvents, type MyEvents } from "@/features/app/my-events";
import { useApp } from "@/features/app/provider";

/** Meus eventos: gestão separada da apresentação pública. Só os eventos da própria conta (criados ou em que entrou). */
export default function MeusEventos() {
  const { repos, ready, user, now, backend, canCreate, signInWithGoogle } = useApp();
  const [data, setData] = useState<MyEvents | undefined>();
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    try {
      setData(await loadMyEvents(repos, user.id, now()));
    } catch {
      setFailed(true);
    }
  }, [repos, user, now]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const organizer = backend === "local" || canCreate;
  const row = (e: MemoEvent, host: boolean) => {
    const live = eventStatus(e, now()) === "ativo";
    return (
    <li key={e.id} className="app-card app-card--borda" style={{ listStyle: "none" }}>
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
  const section = (id: string, title: string, list: MemoEvent[], host: boolean) =>
    list.length > 0 && (
      <section className="app-stack-sm" aria-labelledby={id}>
        <h2 id={id} className="titulo-card app-h1">{title}</h2>
        <ul className="app-stack" style={{ padding: 0, margin: 0 }}>{list.map((e) => row(e, host))}</ul>
      </section>
    );

  let body;
  if (!ready || (user && !data && !failed)) body = <Skeleton label="Carregando seus eventos…" />;
  else if (!user || (!organizer && !data?.joined.length)) {
    body = (
      <>
        <p className="corpo app-p app-muted">Entre com a conta Google que você usou para criar seus eventos.</p>
        <GoogleButton block onClick={() => void signInWithGoogle("/eventos")} />
        <Button href="/entrar" variant="texto">Entrar com código</Button>
      </>
    );
  } else if (failed) {
    body = (
      <div className="app-banner" role="alert">
        <span>Não conseguimos carregar seus eventos. Confira a conexão.</span>
        <Button variant="pequeno" onClick={() => void load()}>Tentar de novo</Button>
      </div>
    );
  } else if (data && !data.active.length && !data.ended.length && !data.joined.length) {
    body = (
      <>
        <p className="corpo app-p app-muted">Você ainda não criou nenhum evento.</p>
        <Button href="/criar" variant="cta" block>Criar meu evento grátis</Button>
      </>
    );
  } else if (data) {
    body = (
      <>
        {section("ativos", "Ativos", data.active, true)}
        {section("encerrados", "Encerrados", data.ended, true)}
        {section("entrei", "Festas em que você entrou", data.joined, false)}
        {organizer && <Button href="/criar" block>Criar outro evento</Button>}
      </>
    );
  }

  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-topbar">
        <Link href="/" aria-label="Início"><Logo variant="wordmark" size={128} /></Link>
      </div>
      <div className="app-screen">
        <h1 className="titulo-tela app-h1">Meus eventos</h1>
        {body}
      </div>
    </main>
  );
}
