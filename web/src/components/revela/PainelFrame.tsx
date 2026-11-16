"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BackButton, PainelEmbedContext, PainelSlotsContext, type PainelSlots } from "@/revela/painel-ui";
import { CountBadge } from "./CountBadge";

export interface PainelTab { href: string; label: string; current: boolean; count?: number }

export interface PainelFrameProps {
  /** Título único da tela (o único `h1`). */
  title: string;
  /** Nome do evento, em letra pequena sob o título. */
  eventName?: string;
  /** Rota pai: a seta leva para lá (nunca o histórico do navegador). */
  backHref: string;
  backLabel?: string;
  /** Abas do painel; sem elas (erro, sem acesso) o quadro mostra só o cabeçalho. */
  tabs?: PainelTab[];
  children: ReactNode;
}

/**
 * Quadro mobile único das telas do painel: cabeçalho e abas fixos no topo (com a área segura), corpo com respiro
 * para a barra do navegador e rodapé fixo opcional (`PainelFoot`). Coluna de 480 px em qualquer largura.
 */
export function PainelFrame({ title, eventName, backHref, backLabel = "Voltar", tabs, children }: PainelFrameProps) {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  const [action, setAction] = useState<HTMLElement | null>(null);
  const [edge, setEdge] = useState({ start: false, end: false });
  const slots = useMemo<PainelSlots>(() => ({ foot, action }), [foot, action]);

  // a aba atual aparece inteira, centralizada, sem rolar a página na vertical
  const currentHref = tabs?.find((t) => t.current)?.href;
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [currentHref]);

  // sombra só do lado em que ainda há abas escondidas
  const tabCount = tabs?.length ?? 0;
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const measure = () => setEdge((prev) => {
      const next = { start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [tabCount]);

  // alturas do cabeçalho e do rodapé fixos: o foco e o "rolar até" não ficam por baixo deles (scroll-padding no <html>)
  useEffect(() => {
    const html = document.documentElement;
    const put = (name: string, el: HTMLElement | null) => html.style.setProperty(name, `${el && el.childElementCount > 0 ? el.offsetHeight : 0}px`);
    const update = () => { put("--pf-top", topRef.current); put("--pf-foot", foot); };
    update();
    const cleanup = () => { html.style.removeProperty("--pf-top"); html.style.removeProperty("--pf-foot"); };
    if (typeof ResizeObserver === "undefined") return cleanup;
    const ro = new ResizeObserver(update);
    const mo = new MutationObserver(update);
    if (topRef.current) ro.observe(topRef.current);
    if (foot) { ro.observe(foot); mo.observe(foot, { childList: true }); }
    return () => { ro.disconnect(); mo.disconnect(); cleanup(); };
  }, [foot]);

  return (
    <main className="pf">
      <div ref={topRef} className="pf-top no-print">
        <header className="pf-head">
          <BackButton label={backLabel} onBack={() => router.push(backHref)} />
          <div className="pf-heading">
            <h1 className="pf-title">{title}</h1>
            {eventName && <p className="pf-sub">{eventName}</p>}
          </div>
          <div className="pf-action" ref={setAction} />
        </header>
        {tabCount > 0 && (
          <nav className="pf-tabs-wrap" aria-label="Seções do painel">
            <div ref={tabsRef} className="pf-tabs" data-start={edge.start} data-end={edge.end}>
              {tabs?.map((t) => (
                <Link key={t.href} href={t.href} className="pf-tab rv-press" aria-current={t.current ? "page" : undefined}>
                  {t.label}
                  {t.count ? <CountBadge count={t.count} /> : null}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
      <PainelSlotsContext.Provider value={slots}>
        <PainelEmbedContext.Provider value>
          <div className="pf-body">{children}</div>
        </PainelEmbedContext.Provider>
      </PainelSlotsContext.Provider>
      <div className="pf-foot no-print" ref={setFoot} />
    </main>
  );
}
