"use client";
/* Interruptor "Mais poses" (+12 poses por pessoa) sob os cartões de plano. Mesmo markup do interruptor das poses do assistente. */

export interface PackSwitchProps {
  /** "+R$ 19,90" (vem do catálogo real). */
  price: string;
  /** "+12 poses por pessoa (24 → 36)". */
  meta: string;
  on: boolean;
  /** Já incluído (quem já tem o pacote): ligado e sem alternar. */
  locked?: boolean;
  onToggle?: (on: boolean) => void;
}

export function PackSwitch({ price, meta, on, locked, onToggle }: PackSwitchProps) {
  const flip = () => { if (!locked) onToggle?.(!on); };
  return (
    <div className="rv-group" data-testid="mais-poses-opcao">
      <div className="rv-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M21 16l-5-5-9 9" />
        </svg>
        <div className="rv-row__text">
          Mais poses <b>{locked ? "incluído" : price}</b>
          <span className="rv-row__meta">{meta}</span>
        </div>
        <span className={`rv-toggle${on ? " rv-toggle--on" : ""}`} role="switch" aria-checked={on} aria-disabled={locked || undefined} aria-label={`Mais poses ${price}`}
          tabIndex={locked ? -1 : 0} style={{ cursor: locked ? "default" : "pointer" }}
          onClick={flip} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } }} />
      </div>
    </div>
  );
}
