"use client";
/* Gerado de design-system/revela/html/Convidado-programacao.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface Momento { time: string; name: string; state: "done" | "on" | "next" }
export interface ProgramacaoProps {
  place?: string;
  /** endereço/cidade em segunda linha; vazio omite */
  address?: string;
  mapHref?: string;
  moments?: Momento[];
  onBack?: () => void;
}
const DEFAULT_MOMENTS: Momento[] = [
  { time: "16:30", name: "Cerimônia", state: "done" }, { time: "17:30", name: "Fotos com os noivos", state: "done" }, { time: "19:00", name: "Jantar", state: "done" },
  { time: "21:00", name: "Primeira dança", state: "on" }, { time: "22:30", name: "Bolo", state: "next" }, { time: "23:00", name: "Pista até o fim", state: "next" },
];

export function ConvidadoProgramacao({ place = "Espaço Vila Jardim", address = "Av. das Palmeiras, 1200 · Cuiabá", mapHref, moments = DEFAULT_MOMENTS, onBack }: ProgramacaoProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Programação
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="place">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <div style={{ "flex": "1" }}>
            <b>{place}</b>
          {address ? <span className="rv-caption">{address}</span> : null}
          </div>
          <a className="rv-btn rv-btn--sm" href={mapHref ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place, address].filter(Boolean).join(" "))}`} target="_blank" rel="noopener noreferrer">Mapa</a>
        </div>
        <div className="moms">
          {moments.map((m, i) => (
            <div key={i} className={`mom${m.state === "done" ? " done" : m.state === "on" ? " on" : ""}`}>
              <span className="rv-stamp">{m.time}</span>
              <i />
              <div>
                <b>{m.name}</b>
              </div>
            </div>
          ))}
        </div>
        <div className="grow" />
        <p className="rv-caption center">
          Cada foto leva o momento em que foi tirada.
        </p>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
