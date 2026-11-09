"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { AdminNav, Breadcrumbs, Button, CountBadge, EventTheme, GoogleButton, Icon, Skeleton } from "@/components/revela";
import { eventStatus } from "@/domain/event";
import { LOCAL_ACTOR, can } from "@/domain/roles";
import { computeRevealStatus } from "@/domain/reveal";
import { moderationQueue } from "@/domain/photo";
import { formatDate, isUuid, useClock, useEventData } from "@/features/app/hooks";
import { copyFor } from "@/features/app/copy";
import { useApp } from "@/features/app/provider";
import { AdminProvider } from "@/features/admin/context";

const SECTIONS = [
  { slug: "", label: "Visão geral" },
  { slug: "plano", label: "Plano" },
  { slug: "conteudo", label: "Conteúdo" },
  { slug: "convidados", label: "Convidados" },
  { slug: "momentos", label: "Momentos" },
  { slug: "qr", label: "QR Code Studio" },
  { slug: "aparencia", label: "Aparência" },
  { slug: "configuracoes", label: "Configurações" },
  { slug: "downloads", label: "Downloads" },
] as const;

/** Painel do anfitrião. Só abre para quem criou o evento (neste aparelho, no modo local). */
export default function PainelLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const { user, ready, repos, now: clock, authority, backend, canCreate, signInWithGoogle } = useApp();
  const data = useEventData({ id });
  const { now, sync } = useClock();
  const { refresh: reload } = data;
  const refresh = useCallback(async () => {
    await reload();
    sync();
  }, [reload, sync]);
  const evId = data.event?.id;
  const stored = data.event?.revealStatus;
  const computed = data.event ? computeRevealStatus(data.event, now) : undefined;
  useEffect(() => {
    if (!evId || !stored || !computed || stored === computed) return;
    void authority.tick(repos, evId, clock()).then(reload);
  }, [evId, stored, computed, repos, authority, clock, reload]);
  const pending = useMemo(() => moderationQueue(data.photos).length, [data.photos]);

  if (!ready || data.loading) return <main className="app-admin"><div className="app-admin-main"><Skeleton label="Abrindo o painel…" /></div></main>;
  if (data.error) return <main className="app-col app-fluid"><div className="app-screen">
    <h1 className="titulo-tela app-h1">{data.error === "forbidden" || data.error === "unauthorized" ? "Não foi possível confirmar seu acesso." : "Não deu para carregar o evento."}</h1>
    <p className="app-p app-muted">{data.error === "forbidden" || data.error === "unauthorized" ? "Confira se você está com a conta usada neste evento e tente de novo." : "Confira a conexão e tente de novo. O link do evento continua o mesmo."}</p>
    <Button block onClick={() => void refresh()}>Tentar de novo</Button>
    {(data.error === "forbidden" || data.error === "unauthorized") && backend === "supabase" && <GoogleButton block label="Entrar com a conta do evento" onClick={() => void signInWithGoogle(`/painel/${id}`)} />}
    <Button href="/eventos" variant="texto">Meus eventos</Button>
  </div></main>;
  if (data.access === "convite" && data.preview) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Só o anfitrião abre o painel.</h1><Button href={`/e/${data.preview.code}`} block>Entrar na festa</Button></div></main>;
  if (!data.event) {
    // na nuvem, sem a conta do organizador o servidor não devolve o evento: pedir o login é mais útil que "não existe"
    if (backend === "supabase" && !canCreate && isUuid(id)) {
      return (
        <main className="app-col app-fluid"><div className="app-screen">
          <h1 className="titulo-tela app-h1">Entre com a conta Google que criou este evento.</h1>
          <p className="app-p app-muted">O painel só abre para quem criou o evento.</p>
          <GoogleButton block onClick={() => void signInWithGoogle(`/painel/${id}`)} />
          <Button href="/" variant="texto">Voltar ao início</Button>
        </div></main>
      );
    }
    return (
      <main className="app-col app-fluid"><div className="app-screen">
        <span aria-hidden="true" className="app-empty-icon" style={{ display: "grid", placeItems: "center", width: 72, height: 72, borderRadius: "50%", background: "var(--surface-2)" }}><Icon name="explorar" decorative size={28} /></span>
        <h1 className="titulo-tela app-h1">Não achamos este evento.</h1>
        <p className="app-p app-muted">{copyFor(backend).panelNotFoundBody}</p>
        <div className="app-stack-sm" style={{ marginTop: "auto" }}>
          <Button href="/eventos" block>Ir para meus eventos</Button>
          {backend === "supabase" && <GoogleButton block label="Entrar com outra conta" onClick={() => void signInWithGoogle("/")} />}
        </div>
      </div></main>
    );
  }
  if (!can(LOCAL_ACTOR(user?.id ?? null), "event.configure", data.event)) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Só o anfitrião abre o painel.</h1><Button href={`/e/${data.event.code}`} block>Entrar na festa</Button></div></main>;

  const event = data.event;
  const base = `/painel/${id}`;
  const state = `${formatDate(event.startAt)} · ${eventStatus(event, now) === "ativo" ? "ao vivo" : "encerrado"}`;
  const items = SECTIONS.map((s) => {
    const href = s.slug ? `${base}/${s.slug}` : base;
    return { href, label: s.label, current: s.slug ? path.startsWith(href) : path === base, count: s.slug === "conteudo" ? pending : undefined };
  });

  const section = items.find((i) => i.current);
  const crumbs = [{ label: "Meus eventos", href: "/eventos" }, section && section.href !== base ? { label: event.title, href: base } : { label: event.title }, ...(section && section.href !== base ? [{ label: section.label }] : [])];
  return (
    <AdminProvider value={{ event, now, photos: data.photos, reactions: data.reactions, participants: data.participants, refresh }}>
      <EventTheme wrap={event.cameraStyle} className="app-admin app-fluid">
        <div className="app-admin-side no-print"><AdminNav eventName={event.title} eventState={state} switchHref="/eventos" items={items} /></div>
        <main className="app-admin-main">
          <nav className="app-admin-navm no-print" aria-label="Administração do evento">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="rvl-tab" aria-current={i.current ? "page" : undefined} style={i.current ? { background: "var(--revela)", color: "var(--on-revela)", fontWeight: 700 } : undefined}>
                {i.label}
                {i.count ? <CountBadge count={i.count} /> : null}
              </Link>
            ))}
          </nav>
          <Breadcrumbs className="no-print" items={crumbs} />
          {children}
        </main>
      </EventTheme>
    </AdminProvider>
  );
}
