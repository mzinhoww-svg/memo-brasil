import Link from "next/link";

/** Barra de abas do convidado (Feed / Minhas / Você): `nav.tabs` de Convidado-laboratorio.html, com links reais. */
export function GuestTabs({ code, current }: { code?: string; current: "feed" | "minhas" | "voce" }) {
  const href = (p: string) => (code ? `/e/${code}/${p}` : "#");
  const tab = (id: "feed" | "minhas" | "voce") => `rv-tab rv-press${current === id ? " rv-tab--on" : ""}`;
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
        <Link href={href("voce")} className={tab("voce")} aria-current={current === "voce" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          <span>Você</span>
        </Link>
      </div>
    </nav>
  );
}
