"use client";
/* Feed-aviso.html (24b): mesmo markup da referência; dados reais por props (padrão = desenho). */
export interface FeedAvisoProps {
  /** "DOM 15 MAR" */
  stamp?: string;
  /** hora do aparelho, "12:00" */
  time?: string;
  /** primeira linha do corpo da notificação */
  body?: string;
  /** fundo (uma foto do evento) */
  background?: string;
  onOpen?: () => void;
}

export function FeedAviso({ stamp = "DOM 15 MAR", time = "12:00", body = "As 418 fotos de Ana & Leo estão no feed. 27 são suas.", background = "/revela/ref/sc-pista.jpg", onOpen }: FeedAvisoProps = {}) {
  const tap = onOpen && { role: "button" as const, tabIndex: 0, "aria-label": "Abrir a notificação: Revelou!", style: { cursor: "pointer" }, onClick: onOpen, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } };
  return (
    <>
    <div className="scr camscr">
      <div className="vf vf--full">
        <img src={background} alt="" />
        <div className="vfdim" style={{ background: "var(--k-0e0c0bd9)" }} />
      </div>
      <div className="lockscr">
        <div className="rv-stamp">{stamp}</div>
        <div className="lk-time">{time}</div>
        <div className="lk-note" {...tap}>
          <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="16" fill="var(--surface-1)" />
            <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
            <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="lk-h">
              <b>Revela</b>
              <span>agora</span>
            </div>
            <div className="lk-t">Revelou!</div>
            <div className="lk-b">{body}</div>
          </div>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
