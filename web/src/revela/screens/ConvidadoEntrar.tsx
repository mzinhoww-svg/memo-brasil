"use client";
/* Convidado-entrar.html (20b): câmera do evento, cota de poses, nome e e-mail opcional. Sem props, mostra os dados do desenho. */
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
  email?: string;
  nameError?: string;
  emailError?: string;
  busy?: boolean;
  /** Quem já está dentro do evento: no lugar dos campos aparece "Você está dentro, …" e o `cta`. */
  inside?: string;
  /** Botões de quem já entrou (abrir câmera, abrir painel). */
  cta?: ReactNode;
  /** Avisos e atalhos do app abaixo do formulário. */
  extra?: ReactNode;
  onName?: (value: string) => void;
  onEmail?: (value: string) => void;
  onSubmit?: () => void;
}

const MAIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);

export function ConvidadoEntrar({
  title = "Ana & Leo", wrap = "casamento", stamp = "SÁB 14 MAR 2027", printDate, poses = 27, welcome, name = "Bia Moraes", email = "bia.moraes@email.com",
  nameError, emailError, busy, inside, cta, extra, onName, onEmail, onSubmit,
}: ConvidadoEntrarProps = {}) {
  const [focus, setFocus] = useState<"name" | "email" | null>("name");
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
            <label className={`rv-field${emailError ? " rv-field--err" : focus === "email" ? " rv-field--focus" : ""}`} style={{ "marginTop": "10px" }}>
              {MAIL}
              <input type="email" inputMode="email" value={email} onChange={(e) => onEmail?.(e.target.value)} onFocus={() => setFocus("email")} onBlur={() => setFocus(null)} aria-label="E-mail (opcional)" placeholder="E-mail (opcional)" autoComplete="email" maxLength={254} aria-describedby="email-ajuda" aria-invalid={emailError ? true : undefined} />
            </label>
            <p className={`rv-caption${emailError ? " rv-caption--err" : ""}`} id="email-ajuda" style={{ "marginTop": "10px" }}>
              {emailError ?? "E-mail opcional. Só serve para avisar quando as fotos revelarem."}
            </p>
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
