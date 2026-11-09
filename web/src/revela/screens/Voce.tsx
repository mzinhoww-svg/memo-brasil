"use client";
/* Gerado de design-system/revela/html/Voce.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import { HostTabs } from "../HostTabs";

export interface VoceProps {
  name?: string; initial?: string; caption?: string;
  /** Valor à direita de uma linha (ex.: telefone); ausente = chevron do desenho. */
  actions?: Record<string, () => void>;
}

export function Voce({ name = "Ana Ribeiro", initial = "A", caption = "3 câmeras · 61 poses tiradas", actions = {} }: VoceProps = {}) {
  const act = (label: string) => (actions[label] ? { role: "button" as const, tabIndex: 0, style: { cursor: "pointer" }, onClick: actions[label], onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); actions[label](); } } } : {});
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "paddingBottom": "92px" }}>
        <div className="row" style={{ "gap": "14px", "marginTop": "8px" }}>
          <span className="avatar avatar--photo">
            {initial}
          </span>
          <div>
            <h1 className="rv-title" style={{ "fontSize": "26px" }}>
              {name}
            </h1>
            <p className="rv-caption">
              {caption}
            </p>
          </div>
        </div>
        <div className="rv-group-h">
          Sua conta
        </div>
        <div className="rv-group">
          <div className="rv-row" {...act("Nome e foto")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            <div className="rv-row__text">
              Nome e foto
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row" {...act("Telefone")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
            <div className="rv-row__text">
              Telefone
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row" {...act("Avisos de revelação")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
            <div className="rv-row__text">
              Avisos de revelação
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
        <div className="rv-group-h">
          Extras
        </div>
        <div className="rv-group">
          <div className="rv-row" {...act("Álbuns impressos")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" />
              <path d="M4 16a4 4 0 0 1 4-4h10" />
            </svg>
            <div className="rv-row__text">
              Álbuns impressos
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row" {...act("Ícone do app")}>
            <span style={{ "display": "inline-flex" }}>
              <svg width="20" height="20" viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="16" fill="var(--surface-1)" />
                <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
                <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="rv-row__text">
              Ícone do app
            </div>
            <span className="rv-row__end">
              {"Laranja "}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
        <div className="rv-group-h">
          Ajuda
        </div>
        <div className="rv-group">
          <div className="rv-row" {...act("Como funciona a revelação")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" />
            </svg>
            <div className="rv-row__text">
              Como funciona a revelação
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row" {...act("Falar com a gente")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />
            </svg>
            <div className="rv-row__text">
              Falar com a gente
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row" {...act("Privacidade")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            </svg>
            <div className="rv-row__text">
              Privacidade
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
        <div className="rv-group" style={{ "marginTop": "20px" }}>
          <div className="rv-row" {...act("Sair")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
            </svg>
            <div className="rv-row__text">
              Sair
            </div>
          </div>
        </div>
      </div>
      <HostTabs current="voce" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
