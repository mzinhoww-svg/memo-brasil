import Link from "next/link";

/** Barra de abas do anfitrião (Câmeras / Revelados / Você): `nav.tabs` de Anfitriao-inicio.html, com links reais. */
export function HostTabs({ current }: { current: "cameras" | "revelados" | "voce" }) {
  const tab = (id: string) => `rv-tab rv-press${current === id ? " rv-tab--on" : ""}`;
  const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <nav className="tabs">
      <div className="rv-tabbar">
        <Link href="/eventos" className={tab("cameras")} aria-current={current === "cameras" ? "page" : undefined}>
          <svg {...svg}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="4" /></svg>
          <span>Câmeras</span>
        </Link>
        <Link href="/eventos/revelados" className={tab("revelados")} aria-current={current === "revelados" ? "page" : undefined}>
          <svg {...svg}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
          <span>Revelados</span>
        </Link>
        <Link href="/eventos/voce" className={tab("voce")} aria-current={current === "voce" ? "page" : undefined}>
          <svg {...svg}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          <span>Você</span>
        </Link>
      </div>
    </nav>
  );
}
