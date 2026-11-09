"use client";
/* Gerado de design-system/revela/html/Pagamento-trocar-plano.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
import { PLANS_REF, planShift, type PlanView } from "./CameraPublicar";

export interface Gauge { label: string; text: string; pct: number; warn?: boolean }
export interface PagamentoTrocarPlanoProps {
  current?: string; gauges?: Gauge[]; warning?: string | null; plans?: PlanView[]; selected?: string; payNote?: string; cta?: string; busy?: boolean; error?: string;
  onSelect?: (code: string) => void; onBack?: () => void; onConfirm?: () => void;
}

export function PagamentoTrocarPlano({
  current = "Festa · R$ 29", gauges = [{ label: "Convidados", text: "28 de 30", pct: 93, warn: true }, { label: "Poses por pessoa", text: "24 de 24", pct: 100 }],
  warning = 'Faltam 2 lugares. Quem chegar depois vê "câmera lotada".', plans = PLANS_REF, selected = "celebracao", payNote = "Pix ou cartão, sem sair do app", cta = "Trocar para Celebração · R$ 89", busy, error, onSelect, onBack, onConfirm,
}: PagamentoTrocarPlanoProps = {}) {
  const idx = Math.max(0, plans.findIndex((p) => p.code === selected));
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
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Plano do evento
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="hero-ev" style={{ "marginTop": "14px" }}>
          <div className="row between">
            <span className="rv-caption">
              Plano atual
            </span>
            <span className="badge">
              {current}
            </span>
          </div>
          <div style={{ "marginTop": "14px" }} className="stack">
            {gauges.map((g) => (
              <div key={g.label} className={`gauge${g.warn ? " gauge--warn" : ""}`}>
                <div className="row between">
                  <span>{g.label}</span>
                  <b>{g.text}</b>
                </div>
                <i>
                  <s style={{ width: `${g.pct}%` }} />
                </i>
              </div>
            ))}
          </div>
          {warning && <p className="rv-caption" style={{ "marginTop": "12px", "color": "var(--carimbo)" }}>{warning}</p>}
        </div>
        <h2 className="rv-group-h">
          Aumentar para
        </h2>
        <div className="planscroll">
          <div className="rv-plans rv-plans--scroll" role="radiogroup" aria-label="Plano do evento" style={{ transform: `translateX(-${planShift(idx, plans.length)}px)` }}>
            {plans.map((p) => (
              <div key={p.code} role="radio" aria-checked={p.code === selected} tabIndex={0} aria-label={`${p.tier}, ${p.price}`} className={`rv-plan${p.code === selected ? " rv-plan--on" : ""}${p.gold ? " rv-plan--gold" : ""}`} onClick={() => onSelect?.(p.code)} style={{ cursor: "pointer" }}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect?.(p.code); } }}>
                <span className="rv-plan__tier">{p.tier}</span>
                <span className="rv-plan__price">{p.price}</span>
                <span className="rv-plan__note">{p.lines[0]}<br />{p.lines[1]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grow" />
        <div className="paynote">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
          </svg>
          <span>
            {payNote}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            ValidaPay
          </span>
        </div>
        {error && <p className="rv-caption center" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onConfirm} disabled={busy}>
          {cta}
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
