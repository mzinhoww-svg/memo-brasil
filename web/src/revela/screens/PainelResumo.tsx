/* Gerado de design-system/revela/html/Painel-resumo.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
"use client";
import Link from "next/link";

export interface PainelResumoProps {
  name?: string;
  live?: boolean;
  stamp?: string;
  tiles?: { guests: string; guestsOf: string; photos: string; photosNote: string; reports: string; reportsNote: string };
  gauge?: { label: string; text: string; pct: number; warn?: boolean };
  /** Os oito cartões do painel, na ordem do desenho: texto de apoio e destino. */
  cards?: { sub: string; href: string }[];
  settingsHref?: string;
  onBack?: () => void;
}
export const PAINEL_RESUMO_REF: Required<PainelResumoProps> = {
  name: "Ana & Leo", live: true, stamp: "REVELA DOM 12:00",
  tiles: { guests: "32", guestsOf: "de 250", photos: "418", photosNote: "+38 na última hora", reports: "2", reportsNote: "para revisar" },
  gauge: { label: "Lugares usados", text: "32 de 250", pct: 13 },
  cards: [
    { sub: "32 entraram", href: "#" }, { sub: "12 links", href: "#" }, { sub: "6 momentos", href: "#" }, { sub: "1 agendado", href: "#" },
    { sub: "2 denúncias", href: "#" }, { sub: "ZIP e CSV", href: "#" }, { sub: "Casamento", href: "#" }, { sub: "Casamento", href: "#" },
  ],
  settingsHref: "#", onBack: () => undefined,
};

export function PainelResumo({ name = PAINEL_RESUMO_REF.name, live = PAINEL_RESUMO_REF.live, stamp = PAINEL_RESUMO_REF.stamp, tiles = PAINEL_RESUMO_REF.tiles, gauge = PAINEL_RESUMO_REF.gauge, cards = PAINEL_RESUMO_REF.cards, settingsHref = "#", onBack }: PainelResumoProps = {}) {
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
          <h1 className="rv-title" style={{ "fontSize": "18px" }}>
            {name}
          </h1>
          <Link href={settingsHref} className="rv-icon-btn" aria-label="Ajustes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        </div>
        <div className="row between" style={{ "marginTop": "16px" }}>
          {live ? <span className="live"><i className="rv-live-dot" />Rolando agora</span> : <span className="rv-caption">Encerrado</span>}
          <span className="rv-stamp" style={{ "fontSize": "12px" }}>
            {stamp}
          </span>
        </div>
        <div className="tiles" style={{ "marginTop": "12px" }}>
          <div className="tile">
            <span>
              Convidados
            </span>
            <b>
              {tiles.guests}
            </b>
            <small>
              {tiles.guestsOf}
            </small>
          </div>
          <div className="tile">
            <span>
              Fotos
            </span>
            <b>
              {tiles.photos}
            </b>
            <small>
              {tiles.photosNote}
            </small>
          </div>
          <div className="tile">
            <span>
              Denúncias
            </span>
            <b>
              {tiles.reports}
            </b>
            <small>
              {tiles.reportsNote}
            </small>
          </div>
        </div>
        <div className="stack" style={{ "marginTop": "14px" }}>
          <div className={`gauge${gauge.warn ? " gauge--warn" : ""}`}>
            <div className="row between">
              <span>
                {gauge.label}
              </span>
              <b>
                {gauge.text}
              </b>
            </div>
            <i>
              <s style={{ "width": `${gauge.pct}%` }} />
            </i>
          </div>
        </div>
        <h2 className="rv-group-h">
          Painel
        </h2>
        <div className="pgrid">
          <Link href={cards[0].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
              <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.4.6 4 2.4 4 5.4" />
            </svg>
            <b>
              Convidados
            </b>
            <span>
              {cards[0].sub}
            </span>
          </Link>
          <Link href={cards[1].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
            <b>
              Convites e mesas
            </b>
            <span>
              {cards[1].sub}
            </span>
          </Link>
          <Link href={cards[2].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <b>
              Programação
            </b>
            <span>
              {cards[2].sub}
            </span>
          </Link>
          <Link href={cards[3].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
            <b>
              Avisos
            </b>
            <span>
              {cards[3].sub}
            </span>
          </Link>
          <Link href={cards[4].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
            </svg>
            <b>
              Moderação
            </b>
            <span>
              {cards[4].sub}
            </span>
          </Link>
          <Link href={cards[5].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            <b>
              Downloads
            </b>
            <span>
              {cards[5].sub}
            </span>
          </Link>
          <Link href={cards[6].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="8" cy="10" r="1.2" fill="currentColor" />
              <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
              <circle cx="16" cy="10" r="1.2" fill="currentColor" />
              <path d="M12 21a2 2 0 0 1 0-4h2a3 3 0 0 0 3-3" />
            </svg>
            <b>
              Aparência
            </b>
            <span>
              {cards[6].sub}
            </span>
          </Link>
          <Link href={cards[7].href} className="pcard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
            </svg>
            <b>
              Plano
            </b>
            <span>
              {cards[7].sub}
            </span>
          </Link>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
