"use client";
/* Camera-publicar.html (passo 8): mesmo markup e classes da referência; planos do catálogo por props (padrão = desenho). */
import { WizardSheet } from "../WizardSheet";

export interface PlanView { code: string; tier: string; price: string; lines: [string, string]; gold?: boolean }
export const PLANS_REF: PlanView[] = [
  { code: "gratis", tier: "Grátis", price: "Grátis", lines: ["10 convidados", "10 poses cada"] },
  { code: "festa", tier: "Festa", price: "R$ 29", lines: ["30 convidados", "24 poses cada"] },
  { code: "celebracao", tier: "Celebração", price: "R$ 89", lines: ["100 convidados", "24 poses cada"] },
  { code: "casamento", tier: "Casamento", price: "R$ 189", lines: ["250 convidados", "36 poses cada"] },
  { code: "grande", tier: "Grande", price: "R$ 349", lines: ["500 convidados", "poses livres"], gold: true },
];

const PLAN_W = 112, GAP = 8, VIEW = 350;
/** Deslocamento da faixa para o plano marcado ficar à vista (no desenho, o 4º plano pede 150 px). */
export function planShift(index: number, count: number): number {
  const total = count * PLAN_W + (count - 1) * GAP;
  return Math.max(0, Math.min(index * (PLAN_W + GAP) - 210, total - VIEW));
}

export interface CameraPublicarProps {
  image?: string; wrapLabel?: string; posesLabel?: string; revealLabel?: string;
  plans?: PlanView[]; selected?: string; payNote?: string; next?: string; busy?: boolean; error?: string;
  onSelect?: (code: string) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraPublicar({
  image = "/revela/ref/cam-casamento.webp", wrapLabel = "Casamento", posesLabel = "27 por pessoa", revealLabel = "dom, 12:00",
  plans = PLANS_REF, selected = "casamento", payNote = "Pix ou cartão, sem sair do app", next = "Continuar · R$ 189", busy, error, onSelect, onBack, onNext,
}: CameraPublicarProps = {}) {
  const idx = Math.max(0, plans.findIndex((p) => p.code === selected));
  return (
    <WizardSheet step={8} title="Escolha o plano" caption="Pague uma vez por evento. Sem assinatura." onBack={onBack} onNext={onNext} next={next} busy={busy}>
      <div className="rv-stagebox" style={{ marginTop: "-6px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- render 3D do kit, WebP responsivo */}
        <img src={image} alt="Câmera do evento" style={{ width: "260px" }} />
      </div>
      <div className="summary">
        <div><span className="rv-caption">Embalagem</span><b>{wrapLabel}</b></div>
        <div><span className="rv-caption">Poses</span><b>{posesLabel}</b></div>
        <div><span className="rv-caption">Revela</span><b>{revealLabel}</b></div>
      </div>
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
      {error && <p className="rv-caption center" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="paynote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5l3.6 3.6-3.6 3.6-3.6-3.6zM12 14.3l3.6 3.6-3.6 3.6-3.6-3.6zM2.5 12l3.6-3.6 3.6 3.6-3.6 3.6zM14.3 12l3.6-3.6 3.6 3.6-3.6 3.6z" />
        </svg>
        <span>{payNote}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>ValidaPay</span>
      </div>
    </WizardSheet>
  );
}
