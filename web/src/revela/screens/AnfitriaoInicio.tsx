/* Anfitriao-inicio.html (16): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";
import { HostTabs } from "../HostTabs";

export interface ShelfItem { id: string; name: string; cam: string; caption: string; href?: string }
export interface AnfitriaoInicioProps {
  /** Câmera em destaque; ausente = estado vazio (só a prateleira e o botão de montar). */
  hero?: { name: string; cam: string; live: boolean; stamp: string; caption: string; openHref: string; qrHref: string; panelHref?: string; onShare?: () => void } | null;
  shelf?: ShelfItem[];
}

export const HOST_HOME_REF: Required<AnfitriaoInicioProps> = {
  hero: { name: "Ana & Leo", cam: "/revela/ref/cam-casamento.webp", live: true, stamp: "FECHA 23:59", caption: "32 convidados entraram · 418 poses tiradas", openHref: "#", qrHref: "#" },
  shelf: [
    { id: "a", name: "30 anos do Rafa", cam: "/revela/ref/cam-aniversario.webp", caption: "Revela em 2 dias" },
    { id: "b", name: "Happy hour", cam: "/revela/ref/cam-noite.webp", caption: "Revelada · 186 fotos" },
  ],
};

export function AnfitriaoInicio({ hero = HOST_HOME_REF.hero, shelf = HOST_HOME_REF.shelf }: AnfitriaoInicioProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ paddingBottom: "92px" }}>
        <div className="row between">
          <h1 className="rv-title-lg" style={{ fontSize: "30px" }}>Suas câmeras</h1>
          <Link href="/criar" className="rv-icon-btn" aria-label="Montar câmera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
        {hero && (
          <div className="hero-ev">
            <div className="row between">
              {hero.live ? <span className="live"><i className="rv-live-dot" />Rolando agora</span> : <span className="rv-caption">Encerrada</span>}
              <span className="rv-stamp" style={{ fontSize: "12px" }}>{hero.stamp}</span>
            </div>
            <div style={{ margin: "4px -24px -10px" }}>
              <div className="rv-stagebox">
                {/* eslint-disable-next-line @next/next/no-img-element -- render 3D do kit */}
                <img src={hero.cam} alt={`Câmera ${hero.name}`} style={{ width: "330px" }} />
              </div>
            </div>
            <h2 className="ev-title">{hero.name}</h2>
            <p className="rv-caption">{hero.caption}</p>
            <div className="row" style={{ gap: "8px", marginTop: "14px" }}>
              <Link href={hero.openHref} className="rv-btn rv-btn--block rv-btn--primary" style={{ flex: "1" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Abrir câmera
              </Link>
              <Link href={hero.qrHref} className="rv-icon-btn" style={{ width: "56px", height: "56px" }} aria-label="QR code">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4" />
                </svg>
              </Link>
              <button type="button" className="rv-icon-btn" style={{ width: "56px", height: "56px" }} aria-label="Compartilhar" onClick={hero.onShare}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v13M7 8l5-5 5 5" />
                  <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </svg>
              </button>
            </div>
            {hero.panelHref && (
              <Link href={hero.panelHref} className="rv-btn rv-btn--block rv-btn--line" style={{ marginTop: "8px" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
                Painel do evento
              </Link>
            )}
          </div>
        )}
        <div className="shelf-h">
          <span className="rv-group-h" style={{ margin: "0" }}>Na prateleira</span>
        </div>
        <div className="shelf">
          {shelf.map((it, i) => (
            <Link key={it.id} href={it.href ?? "#"} className="shelf-item rv-rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element -- render 3D do kit */}
              <img src={it.cam} alt={`Câmera ${it.name}`} style={{ width: "150px" }} />
              <b>{it.name}</b>
              <span className="rv-caption">{it.caption}</span>
            </Link>
          ))}
        </div>
      </div>
      <HostTabs current="cameras" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
