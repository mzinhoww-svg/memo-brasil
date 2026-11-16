"use client";
/* Convidado-entrar.html (20b): câmera do evento, cota de poses, nome e WhatsApp opcional (avisos). Sem props, mostra os dados do desenho. */
import { useState, type FormEvent, type ReactNode } from "react";
import { CameraStage } from "@/components/revela";
import type { CameraStyle } from "@/domain/options";

export interface ConvidadoEntrarProps {
  title?: string;
  wrap?: CameraStyle;
  /** Carimbo de data, ex.: "SÁB 14 MAR 2027". */
  stamp?: string;
  /** Data impressa na embalagem da câmera. */
  printDate?: string;
  /** Poses por pessoa; `null` = livre. */
  poses?: number | null;
  welcome?: string;
  name?: string;
  /** WhatsApp opcional para o aviso da revelação (no lugar do e-mail) */
  phone?: string;
  nameError?: string;
  phoneError?: string;
  /** Linha de ajuda do WhatsApp (muda quando o WhatsApp já está pronto para abrir). */
  phoneHelp?: string;
  /** Some o campo quando os avisos por WhatsApp estão desligados ou fora do modo nuvem. */
  showPhone?: boolean;
  busy?: boolean;
  /** Quem já está dentro do evento: no lugar dos campos aparece "Você está dentro, …" e o `cta`. */
  inside?: string;
  /** Botões de quem já entrou (abrir câmera, abrir painel). */
  cta?: ReactNode;
  /** Avisos e atalhos do app abaixo do formulário. */
  extra?: ReactNode;
  onName?: (value: string) => void;
  onPhone?: (value: string) => void;
  onSubmit?: () => void;
}

const PHONE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" /></svg>
);

export function ConvidadoEntrar({
  title = "Ana & Leo", wrap = "casamento", stamp = "SÁB 14 MAR 2027", printDate, poses = 27, welcome, name = "Bia Moraes", phone = "",
  nameError, phoneError, phoneHelp, showPhone = true, busy, inside, cta, extra, onName, onPhone, onSubmit,
}: ConvidadoEntrarProps = {}) {
  const [focus, setFocus] = useState<"name" | "phone" | null>("name");
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit?.(); };
  return (
    <>
    <div className="scr scr--scroll">
      <form className="safe" id="entrar-form" noValidate onSubmit={submit}>
        <div className="row between">
          <span style={{ "width": "44px" }} />
          <span className="rv-stamp">
            {stamp}
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div style={{ "display": "flex", "justifyContent": "center", "margin": "4px 0 0" }}>
          <div style={{ "width": "220px", "margin": "-38px 0 -40px", "transform": "scale(1.62)", "filter": "drop-shadow(0 11px 9px var(--k-000000aa))" }}>
            <CameraStage wrap={wrap} size={640} priority print={{ name: title, poses, date: printDate }} />
          </div>
        </div>
        <h1 className="rv-display" style={{ "fontSize": "44px", "lineHeight": "46px", "textAlign": "center", "marginTop": "4px", "overflowWrap": "anywhere", "position": "relative", "zIndex": "1" }}>
          {title}
        </h1>
        {welcome && <p className="rv-body muted" data-testid="mensagem-evento" style={{ "margin": "8px 0 0", "textAlign": "center" }}>{welcome}</p>}
        <div className="quota">
          <div className="rv-counter">
            <b>
              {poses ?? "∞"}
            </b>
            <span>
              {poses === null ? "poses livres" : "poses suas"}
            </span>
          </div>
          <p>
            Foi o que o anfitrião liberou para você. Ninguém vê as fotos antes da revelação.
          </p>
        </div>
        {inside !== undefined ? (
          <h2 className="rv-body muted" style={{ "margin": "0", "textAlign": "center" }}>Você está dentro, {inside}.</h2>
        ) : (
          <>
            <label className={`rv-field${nameError ? " rv-field--err" : focus === "name" ? " rv-field--focus" : ""}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              <input value={name} onChange={(e) => onName?.(e.target.value)} onFocus={() => setFocus("name")} onBlur={() => setFocus(null)} aria-label="Seu nome" placeholder="Seu nome" autoComplete="given-name" maxLength={40} aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? "erro-nome" : undefined} />
            </label>
            {nameError && <p id="erro-nome" className="rv-field-erro" role="alert" style={{ "marginTop": "8px" }}>{nameError}</p>}
            {showPhone && <>
              <label className={`rv-field${phoneError ? " rv-field--err" : focus === "phone" ? " rv-field--focus" : ""}`} style={{ "marginTop": "10px" }}>
                {PHONE}
                <input type="tel" inputMode="tel" value={phone} onChange={(e) => onPhone?.(e.target.value)} onFocus={() => setFocus("phone")} onBlur={() => setFocus(null)} aria-label="WhatsApp com DDD (opcional)" placeholder="WhatsApp com DDD (opcional)" autoComplete="tel-national" maxLength={20} aria-describedby="whatsapp-ajuda" aria-invalid={phoneError ? true : undefined} />
              </label>
              <p className={`rv-caption${phoneError ? " rv-caption--err" : ""}`} id="whatsapp-ajuda" style={{ "marginTop": "10px" }}>
                {phoneError ?? phoneHelp ?? "Opcional. Avisamos no WhatsApp quando as fotos forem reveladas."}
              </p>
            </>}
          </>
        )}
        {extra}
        <div className="grow" />
        {inside !== undefined ? cta : (
          <button type="submit" className="rv-btn rv-btn--block rv-btn--primary" disabled={busy} aria-busy={busy || undefined}>
            {busy ? "Entrando…" : <>
              Entrar e fotografar
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </>}
          </button>
        )}
      </form>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
