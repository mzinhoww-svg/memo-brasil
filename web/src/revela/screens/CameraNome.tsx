"use client";
/* Camera-nome.html (passo 2): mesmo markup da referência. O teclado do desenho é só ilustração: na rota real (`keyboard={false}`) vale o teclado nativo e a barra de ação toma o lugar dele. */
import type { Wrap } from "@/domain/options";

const BACK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export interface CameraNomeProps {
  wrap?: Wrap; name?: string; suggestions?: string[]; error?: string; busy?: boolean;
  /** Mostra o teclado desenhado (só no desenho de referência). */
  keyboard?: boolean;
  onName?: (v: string) => void; onSuggest?: (v: string) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraNome({ wrap = "casamento", name = "Ana & Leo", suggestions = ["Casamento de Ana & Leo", "A&L 14.03"], error, busy, keyboard = true, onName, onSuggest, onBack, onNext }: CameraNomeProps = {}) {
  return (
    <>
    <div className="scr sheet-scr">
      <div className="sheet-full">
        <div className="rv-sheet__grab" />
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 className="rv-title">Nome do evento</h1>
            <p className="rv-caption" style={{ marginTop: "4px" }}>Sai impresso na embalagem.</p>
          </div>
          <span className="rv-stamp" style={{ fontSize: "12px", marginTop: "6px" }} aria-label="Passo 2 de 8">2/8</span>
        </div>
        <div className="rv-steps">
          {Array.from({ length: 8 }, (_, i) => <i key={i} className={i < 2 ? "on" : ""} />)}
        </div>
        <div className="namepreview">
          <img src={`/revela/ref/label-${wrap}.jpg`} alt="Embalagem com o nome do evento" />
        </div>
        <label className="rv-field rv-field--focus" style={{ marginTop: "14px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
          <input value={name} maxLength={60} aria-label="Nome do evento" aria-invalid={error ? true : undefined} autoComplete="off" enterKeyHint="next"
            onChange={(e) => onName?.(e.target.value)} readOnly={!onName} />
        </label>
        {error && <p className="rv-caption" role="alert" style={{ marginTop: "8px", color: "var(--danger)" }}>{error}</p>}
        <div className="row" role="group" aria-label="Sugestões de nome" style={{ gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
          {suggestions.map((t) => (
            <button key={t} type="button" className={`chip${name === t ? " on" : ""}`} aria-pressed={name === t} style={{ border: 0, cursor: "pointer" }} onClick={() => onSuggest?.(t)}>{t}</button>
          ))}
        </div>
        <div className="grow" />
        {keyboard ? (
          <div className="kb">
            <div className="r">
              <span>
                Q
              </span>
              <span>
                W
              </span>
              <span>
                E
              </span>
              <span>
                R
              </span>
              <span>
                T
              </span>
              <span>
                Y
              </span>
              <span>
                U
              </span>
              <span>
                I
              </span>
              <span>
                O
              </span>
              <span>
                P
              </span>
            </div>
            <div className="r">
              <span>
                A
              </span>
              <span>
                S
              </span>
              <span>
                D
              </span>
              <span>
                F
              </span>
              <span>
                G
              </span>
              <span>
                H
              </span>
              <span>
                J
              </span>
              <span>
                K
              </span>
              <span>
                L
              </span>
            </div>
            <div className="r">
              <span className="wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
              <span>
                Z
              </span>
              <span>
                X
              </span>
              <span>
                C
              </span>
              <span>
                V
              </span>
              <span>
                B
              </span>
              <span>
                N
              </span>
              <span>
                M
              </span>
              <span className="wide">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </span>
            </div>
            <div className="r">
              <span className="wide">
                123
              </span>
              <span className="space">
                espaço
              </span>
              <span className="ok">
                OK
              </span>
            </div>
          </div>
        ) : (
          <div className="cta-bar">
            <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack} disabled={busy}>{BACK}</button>
            <button type="button" className="rv-btn rv-btn--primary" onClick={onNext} disabled={busy} aria-busy={busy}>Próximo</button>
          </div>
        )}
      </div>
      <div className="grain" />
    </div>
    </>
  );
}
