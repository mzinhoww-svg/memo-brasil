/* Convidado-codigo.html (20c) e Convidado-codigo-erro.html (20h): uma só tela, com a mesma árvore e as mesmas classes. */
import type { ChangeEvent, FormEvent, ClipboardEvent } from "react";

export interface ConvidadoCodigoProps {
  /** Caracteres digitados (até 8). */
  code?: string;
  /** 20h: o código não abre nenhuma festa. */
  error?: boolean;
  busy?: boolean;
  onChange?: (raw: string) => void;
  onSubmit?: () => void;
  onBack?: () => void;
}

export function ConvidadoCodigo({ code = "TX5EV", error = false, busy = false, onChange, onSubmit, onBack }: ConvidadoCodigoProps = {}) {
  const chars = code.slice(0, 8).split("");
  const full = chars.length === 8;
  const boxes = Array.from({ length: 8 }, (_, i) => chars[i] ?? " ");
  const on = Math.min(chars.length, 7);
  const ready = full && !busy;
  return (
    <>
    <div className="scr">
      <form className="safe" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); if (ready) onSubmit?.(); }}>
        <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="rv-title-lg" style={{ "marginTop": "36px" }}>
          Digite o código
          <br />
          do convite
        </h1>
        <p className="rv-body muted" style={{ "margin": "10px 0 28px" }}>
          Sem QR por perto? O código está no convite impresso, embaixo do QR.
        </p>
        <div className={`otp otp--code${error ? " otp--err" : ""}`} style={{ position: "relative" }}>
          {boxes.map((c, i) => (
            <span key={i} className={error ? undefined : i === on && !full ? "on" : ""}>{c}</span>
          ))}
          <input
            aria-label="Código do convite"
            aria-invalid={error || undefined}
            aria-describedby={error ? "codigo-erro" : "codigo-ajuda"}
            value={code}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
            inputMode="text"
            enterKeyHint="go"
            autoFocus
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
            onPaste={(e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); onChange?.(e.clipboardData.getData("text")); }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, background: "transparent", color: "transparent", caretColor: "transparent", font: "inherit" }}
          />
        </div>
        {error ? (
          <p className="errline" id="codigo-erro" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l9.5 17h-19z" />
              <path d="M12 10v4M12 17v.01" />
            </svg>
            Esse código não abre nenhuma festa. Confira as letras no convite.
          </p>
        ) : (
          <p className="rv-caption" id="codigo-ajuda" style={{ "marginTop": "18px" }}>
            São 8 letras e números. Não tem 0, O, 1 nem I.
          </p>
        )}
        <div className="grow" />
        {error ? (
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={() => onChange?.("")}>
            Tentar de novo
          </button>
        ) : (
          <button type="submit" className="rv-btn rv-btn--block" aria-disabled={!ready} style={{ ...(ready ? { background: "var(--revela)", color: "var(--on-revela)" } : {}) }}>
            Entrar no evento
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </form>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
