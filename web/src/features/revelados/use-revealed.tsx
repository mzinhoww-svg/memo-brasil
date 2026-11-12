"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { MemoEvent } from "@/domain/event";
import { loadMyEvents } from "@/features/app/my-events";
import { useApp } from "@/features/app/provider";
import { HostTabs } from "@/revela/HostTabs";
import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";
import { revealedEvents } from "./pick";

/** Eventos do anfitrião já revelados (o mais recente primeiro). `undefined` = carregando. */
export function useRevealedEvents(): { events: MemoEvent[] | undefined; failed: boolean; signedIn: boolean } {
  const { repos, ready, user, now } = useApp();
  const [events, setEvents] = useState<MemoEvent[] | undefined>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !user) return;
    let live = true;
    const t = setTimeout(() => {
      loadMyEvents(repos, user.id, now()).then(
        (d) => { if (live) setEvents(revealedEvents([...d.active, ...d.ended], now())); },
        () => { if (live) setFailed(true); },
      );
    }, 0);
    return () => { live = false; clearTimeout(t); };
  }, [repos, ready, user, now]);
  return { events, failed, signedIn: Boolean(user) };
}

/** Tela simples no quadro do aparelho (carregando, vazio, erro), com as abas do anfitrião. */
export function HostNote({ title, text, action, tabs = true }: { title?: string; text?: string; action?: ReactNode; tabs?: boolean }) {
  return (
    <div className="scr">
      <div className="safe">
        {title && <h1 className="rv-title-lg">{title}</h1>}
        {text && <p className="rv-body muted" style={{ margin: "10px 0 16px" }}>{text}</p>}
        {action}
      </div>
      {tabs && <HostTabs current="revelados" />}
      <div className="home-ind" />
      <div className="grain" />
    </div>
  );
}

/** Carregando: esqueleto no quadro da tela (com as abas do anfitrião quando a tela final as tem). */
export const LoadingNote = ({ tabs = false, label = "Carregando os revelados…" }: { tabs?: boolean; label?: string }) => (
  <ScreenSkeleton variant="grade" label={label} tabs={tabs ? <HostTabs current="revelados" /> : undefined} />
);
export const GoHome = () => <Link href="/eventos" className="rv-btn rv-btn--block rv-btn--primary">Ver minhas câmeras</Link>;
