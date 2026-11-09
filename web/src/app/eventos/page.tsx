"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, GoogleButton, LiveIndicator, Logo, Skeleton } from "@/components/revela";
import { endAt, eventStatus, type MemoEvent } from "@/domain/event";
import { hhmm } from "@/features/guest/format";
import { AnfitriaoInicio } from "@/revela/screens/AnfitriaoInicio";
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
    if (!ready) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [ready, load]);

  const organizer = backend === "local" || canCreate;
  const [counts, setCounts] = useState<{ guests: number; photos: number } | undefined>();
  const hero = data ? (data.active[0] ?? data.ended[0]) : undefined;
  useEffect(() => {
    if (!hero) return;
    let live = true;
    void Promise.all([repos.participants.count(hero.id), repos.photos.count(hero.id)]).then(([guests, photos]) => { if (live) setCounts({ guests, photos }); }, () => undefined);
    return () => { live = false; };
  }, [repos, hero]);
  const nowMs = now();
  const revealText = (e: MemoEvent) => {
    if (e.revealedAt || (e.revealEnabled && e.revealAt && e.revealAt <= nowMs) || !e.revealEnabled) return "Revelada";
    if (!e.revealAt) return "Revela quando acabar";
    const days = Math.ceil((e.revealAt - nowMs) / 86_400_000);
    return days <= 0 ? "Revela hoje" : `Revela em ${days} ${days === 1 ? "dia" : "dias"}`;
  };

  const row = (e: MemoEvent, host: boolean) => {
    const live = eventStatus(e, nowMs) === "ativo";
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
  }

  if (data && (data.active.length || data.ended.length)) {
    const mine = [...data.active, ...data.ended];
    const heroEv = mine[0];
    const heroLive = eventStatus(heroEv, nowMs) === "ativo";
    const endAtMs = endAt(heroEv);
    return (
      <AnfitriaoInicio
        hero={{
          name: heroEv.title, cam: `/revela/3d/cam-${heroEv.cameraStyle}-960.webp`, live: heroLive,
          stamp: heroLive ? `FECHA ${hhmm(endAtMs, heroEv.timezone)}` : "ENCERRADA",
          caption: counts ? `${counts.guests} ${counts.guests === 1 ? "convidado entrou" : "convidados entraram"} · ${counts.photos} ${counts.photos === 1 ? "pose tirada" : "poses tiradas"}` : " ",
          openHref: `/e/${heroEv.code}/agora`, qrHref: `/painel/${heroEv.id}/qr`,
          onShare: () => { const url = `${window.location.origin}/e/${heroEv.code}`; if (navigator.share) void navigator.share({ title: heroEv.title, url }).catch(() => undefined); else void navigator.clipboard?.writeText(url); },
        }}
        shelf={[...mine.slice(1), ...data.joined].map((e) => ({ id: e.id, name: e.title, cam: `/revela/3d/cam-${e.cameraStyle}-640.webp`, caption: revealText(e), href: e.hostId === user?.id ? `/painel/${e.id}` : `/e/${e.code}/agora` }))}
      />
    );
  }
  if (data && data.joined.length) {
    body = <section className="app-stack-sm"><h2 className="titulo-card app-h1">Festas em que você entrou</h2><ul className="app-stack" style={{ padding: 0, margin: 0 }}>{data.joined.map((e) => row(e, false))}</ul>{organizer && <Button href="/criar" block>Criar meu evento</Button>}</section>;
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
