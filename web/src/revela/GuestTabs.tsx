"use client";
import Link from "next/link";
import { useGuestOptional, useHostNav } from "@/features/events/guest-context";
import { useSmartAlbumUi } from "@/features/smart-album/use-smart-album";

type TabId = "feed" | "minhas" | "voce" | "fotos";

/** "Minhas Fotos" (Smart Album): só com a chave `smart_album_ui` ligada para o evento. Fora do layout do convidado não aparece. */
function SmartAlbumTab({ eventId, href, on }: { eventId: string; href: string; on: boolean }) {
  const enabled = useSmartAlbumUi(eventId);
  if (!enabled) return null;
  return (
    <Link href={href} data-tab="fotos" className={`rv-tab rv-press${on ? " rv-tab--on" : ""}`} aria-current={on ? "page" : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M6.5 19c1-2.5 3-4 5.5-4s4.5 1.5 5.5 4" /></svg>
      <span>Minhas Fotos</span>
    </Link>
  );
}

/** Barra de abas do convidado (Feed / Minhas / Você): `nav.tabs` de Convidado-laboratorio.html, com links reais. */
export function GuestTabs({ code, current }: { code?: string; current: TabId }) {
  const href = (p: string) => (code ? `/e/${code}/${p}` : "#");
  const host = useHostNav();
  const guest = useGuestOptional();
  const tab = (id: TabId) => `rv-tab rv-press${current === id ? " rv-tab--on" : ""}`;
  return (
    <nav className="tabs">
      <div className="rv-tabbar">
        <Link href={href("agora")} className={tab("feed")} aria-current={current === "feed" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
          <span>Feed</span>
        </Link>
        <Link href={href("minhas")} data-tab="minhas" className={tab("minhas")} aria-current={current === "minhas" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="4" /></svg>
          <span>Minhas</span>
        </Link>
        {guest && <SmartAlbumTab eventId={guest.event.id} href={href("minhas-fotos")} on={current === "fotos"} />}
        <Link href={href("voce")} className={tab("voce")} aria-current={current === "voce" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          <span>Você</span>
        </Link>
        {host && (
          <Link href={host.panelHref} data-tab="painel" className="rv-tab rv-press" aria-label="Painel do evento">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
            <span>Painel</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
