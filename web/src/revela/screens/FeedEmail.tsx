"use client";
/* Feed-email.html (24i): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";

export interface MailPrint { src: string }
export const MAIL_REF_PRINTS: MailPrint[] = [{ src: "/revela/ref/sc-bolo.jpg" }, { src: "/revela/ref/sc-aliancas.jpg" }, { src: "/revela/ref/sc-pista.jpg" }];
const SLOTS = [
  { left: "10px", top: "20px", width: "130px", height: "164px", transform: "rotate(-8deg)", zIndex: "1" },
  { left: "150px", top: "0px", width: "130px", height: "164px", transform: "rotate(6deg)", zIndex: "2" },
  { left: "70px", top: "50px", width: "140px", height: "176px", transform: "rotate(-1deg)", zIndex: "3" },
] as const;

export interface FeedEmailProps {
  /** assunto */
  subject?: string;
  /** "Revela <avisos@revela.app> · dom 12:00" */
  from?: string;
  /** "Revelou, Bia." */
  greeting?: string;
  body?: string;
  prints?: MailPrint[];
  backHref?: string;
  /** voltar pelo histórico; `backHref` segue como destino real do link */
  onBack?: () => void;
  openHref?: string;
  onOptOut?: () => void;
}

export function FeedEmail({ subject = "Revelou: as fotos de Ana & Leo", from = "Revela <avisos@revela.app> · dom 12:00", greeting = "Revelou, Bia.", body = "As 418 fotos do casamento estão no feed. 27 são suas. Curta, comente e baixe as que quiser.", prints = MAIL_REF_PRINTS, backHref, onBack, openHref, onOptOut }: FeedEmailProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ background: "var(--paper-back)", color: "var(--on-paper)" }}>
        <div className="row between">
          <Link href={backHref ?? "#"} className="rv-icon-btn" style={{ background: "var(--k-00000012)", color: "var(--on-paper)" }} aria-label="Voltar" onClick={onBack && ((e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onBack(); } })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <span style={{ font: "500 14px/1 var(--font-sans)", color: "var(--k-5c5048)" }}>Caixa de entrada</span>
          <span style={{ width: "44px" }} />
        </div>
        <div className="mail-h">
          <b>{subject}</b>
          <span>{from}</span>
        </div>
        <div className="mail">
          <div className="row" style={{ gap: "10px" }}>
            <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
              <rect width="64" height="64" rx="16" fill="var(--on-paper)" />
              <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
              <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
            <span style={{ font: "400 18px/1 var(--font-display)" }}>revela</span>
          </div>
          <div className="table" style={{ height: "230px", margin: "16px 0 6px" }}>
            {prints.slice(0, 3).map((p, i) => (
              <div key={i} className="rv-print" style={{ position: "absolute", ...SLOTS[i] }}>
                <img src={p.src} alt="Foto de convidado" />
              </div>
            ))}
          </div>
          <h2 style={{ font: "400 30px/34px var(--font-display)", margin: "0" }}>{greeting}</h2>
          <p style={{ font: "400 15px/22px var(--font-sans)", color: "var(--k-4a4039)", margin: "8px 0 16px" }}>{body}</p>
          {openHref ? <Link href={openHref} className="rv-btn rv-btn--primary rv-btn--block">Abrir o feed</Link> : <span className="rv-btn rv-btn--primary rv-btn--block">Abrir o feed</span>}
          <p style={{ font: "400 12px/18px var(--font-sans)", color: "var(--ink-faint)", margin: "14px 0 0" }}>
            {"Você recebeu este aviso porque deixou seu e-mail ao entrar no evento. "}
            <u {...(onOptOut ? { role: "button", tabIndex: 0, style: { cursor: "pointer" }, onClick: onOptOut, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOptOut(); } } } : {})}>Não quero mais avisos</u>
          </p>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
