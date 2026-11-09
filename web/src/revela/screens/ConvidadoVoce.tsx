"use client";
/* Gerado de design-system/revela/html/Convidado-voce.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import { GuestTabs } from "../GuestTabs";

export interface VoceProps {
  code?: string;
  name?: string;
  /** "Convidada de Ana & Leo · Mesa 4" */
  sub?: string;
  used?: number;
  total?: number | null;
  notify?: boolean;
  email?: string;
  onNotify?: () => void;
  onEmail?: () => void;
  onDownload?: () => void;
  onLeave?: () => void;
  onDelete?: () => void;
}

export function ConvidadoVoce({ code, name = "Bia Moraes", sub = "Convidada de Ana & Leo · Mesa 4", used = 9, total = 27, notify = true, email = "bia.moraes@email.com", onNotify, onEmail, onDownload, onLeave, onDelete }: VoceProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ "paddingBottom": "92px" }}>
        <h1 className="rv-title-lg" style={{ "fontSize": "30px" }}>
          Você
        </h1>
        <div className="row" style={{ "gap": "14px", "margin": "18px 0 6px" }}>
          <span className="avatar">{name.trim().charAt(0).toUpperCase()}</span>
          <div>
            <b style={{ "font": "400 22px/26px var(--font-display)" }}>{name}</b>
            <div className="rv-caption">{sub}</div>
          </div>
        </div>
        <div className="stack" style={{ "marginTop": "12px" }}>
          <div className="gauge">
            <div className="row between">
              <span>
                Poses usadas
              </span>
              <b>{total === null ? `${used} usadas` : `${used} de ${total}`}</b>
            </div>
            <i>
              <s style={{ "width": `${total ? Math.min(100, Math.round((used / total) * 100)) : 0}%` }} />
            </i>
          </div>
        </div>
        <h2 className="rv-group-h">
          Avisos
        </h2>
        <div className="rv-group">
          <div className="rv-row" role="switch" aria-checked={notify} tabIndex={0} onClick={onNotify} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onNotify?.(); } }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
            <div className="rv-row__text">
              Avisar quando revelar
              <span className="rv-row__meta">
                No celular e por e-mail
              </span>
            </div>
            <span className={`rv-toggle${notify ? " rv-toggle--on" : ""}`} />
          </div>
          <div className="rv-row" role="button" tabIndex={0} onClick={onEmail} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onEmail?.(); } }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <div className="rv-row__text">
              {email}
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
        <h2 className="rv-group-h">
          Seus dados
        </h2>
        <div className="rv-group">
          <div className="rv-row" role="button" tabIndex={0} onClick={onDownload}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            <div className="rv-row__text">
              Baixar minhas fotos
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row" role="button" tabIndex={0} onClick={onLeave}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
            </svg>
            <div className="rv-row__text">
              Sair deste evento
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <div className="rv-row rv-row--danger" role="button" tabIndex={0} onClick={onDelete}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
            <div className="rv-row__text">
              Apagar meus dados
            </div>
            <span className="rv-row__end">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
      </div>
      <GuestTabs code={code} current="voce" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
