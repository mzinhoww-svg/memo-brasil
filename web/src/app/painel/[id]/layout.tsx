"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { AdminNav, Button, CountBadge, EventTheme } from "@/components/memoriesmt";
import { eventStatus } from "@/domain/event";
import { LOCAL_ACTOR, can } from "@/domain/roles";
import { computeRevealStatus } from "@/domain/reveal";
import { reconcileReveal } from "@/features/events/service";
import { moderationQueue } from "@/domain/photo";
import { formatDate, useClock, useEventData } from "@/features/app/hooks";
import { useApp } from "@/features/app/provider";
import { AdminProvider } from "@/features/admin/context";

const SECTIONS = [
  { slug: "", label: "Visão geral" },
  { slug: "conteudo", label: "Conteúdo" },
  { slug: "convidados", label: "Convidados" },
  { slug: "momentos", label: "Momentos" },
  { slug: "qr", label: "QR Code Studio" },
  { slug: "configuracoes", label: "Configurações" },
  { slug: "downloads", label: "Downloads" },
] as const;

/** Painel do anfitrião. Só abre para quem criou o evento neste aparelho. */
export default function PainelLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const { user, ready, repos, now: clock } = useApp();
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
    void reconcileReveal(repos, evId, clock()).then(reload);
  }, [evId, stored, computed, repos, clock, reload]);
  const pending = useMemo(() => moderationQueue(data.photos).length, [data.photos]);

  if (!ready || data.loading) return <main className="app-admin"><p className="app-admin-main app-muted">Abrindo o painel…</p></main>;
  if (data.access === "convite" && data.preview) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Só o anfitrião abre o painel.</h1><Button href={`/e/${data.preview.code}`} block>Entrar na festa</Button></div></main>;
  if (!data.event) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Não achamos esse evento.</h1><p className="app-p app-muted">Esta versão só abre eventos criados neste aparelho.</p><Button href="/" block>Voltar ao início</Button></div></main>;
  if (!can(LOCAL_ACTOR(user?.id ?? null), "event.configure", data.event)) return <main className="app-col app-fluid"><div className="app-screen"><h1 className="titulo-tela app-h1">Só o anfitrião abre o painel.</h1><Button href={`/e/${data.event.code}`} block>Entrar na festa</Button></div></main>;

  const event = data.event;
  const base = `/painel/${id}`;
  const state = `${formatDate(event.startAt)} · ${eventStatus(event, now) === "ativo" ? "ao vivo" : "encerrado"}`;
  const items = SECTIONS.map((s) => {
    const href = s.slug ? `${base}/${s.slug}` : base;
    return { href, label: s.label, current: s.slug ? path.startsWith(href) : path === base, count: s.slug === "conteudo" ? pending : undefined };
  });

  return (
    <AdminProvider value={{ event, now, photos: data.photos, reactions: data.reactions, participants: data.participants, refresh }}>
      <EventTheme palette={event.palette} font={event.eventFont} className="app-admin app-fluid">
        <div className="app-admin-side no-print"><AdminNav eventName={event.title} eventState={state} switchHref="/" items={items} /></div>
        <main className="app-admin-main">
          <nav className="app-admin-navm no-print" aria-label="Administração do evento">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="mm-tab" aria-current={i.current ? "page" : undefined} style={i.current ? { background: "var(--acao)", color: "var(--on-acao)", fontWeight: 700 } : undefined}>
                {i.label}
                {i.count ? <CountBadge count={i.count} /> : null}
              </Link>
            ))}
          </nav>
          {children}
        </main>
      </EventTheme>
    </AdminProvider>
  );
}
