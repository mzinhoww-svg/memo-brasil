"use client";
/* Camera-poses.html (passo 4): mesmo markup e classes da referência; dados reais por props (padrão = desenho). */
import { WizardSheet } from "../WizardSheet";

/** `n: null` = poses livres. `caption` já traz o custo ("Grátis", "a partir de R$ 59,90"). */
export interface PoseChoice { n: number | null; caption: string }
export const POSE_CHOICES_REF: PoseChoice[] = [
  { n: 10, caption: "Grátis" }, { n: 24, caption: "a partir de R$ 59,90" }, { n: 36, caption: "a partir de R$ 189" },
];

export interface CameraPosesProps {
  /** Posição no assistente (n/8); o desenho mostra 4. */
  step?: number;
  value?: number | null; choices?: PoseChoice[]; roll?: boolean; rollLimit?: number; busy?: boolean;
  /** Aviso curto sob as opções ("Isso muda seu plano para Festa."). */
  notice?: string | null;
  onPick?: (n: number | null) => void; onRoll?: (on: boolean) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraPoses({ step = 4, value = 36, choices = POSE_CHOICES_REF, roll = true, rollLimit = 10, busy, notice, onPick, onRoll, onBack, onNext }: CameraPosesProps = {}) {
  return (
    <WizardSheet step={step} title="Quantas poses?" caption="Cada convidado tem um filme. O plano certo é sugerido no fim." onBack={onBack} onNext={onNext} busy={busy}>
      <div className="posesviz">
        <div className="rv-counter" style={{ transform: "scale(1.35)" }}>
          <b>{value ?? "Livre"}</b>
          <span>{value === null ? "poses por pessoa, sem limite" : "poses por pessoa"}</span>
        </div>
        <div className="filmstrip">
          {Array.from({ length: 14 }, (_, i) => <i key={i} />)}
        </div>
      </div>
      <div className="rv-choices" role="group" aria-label="Poses por pessoa">
        {choices.map((c) => (
          <button key={c.n ?? "livre"} type="button" className={`rv-choice rv-choice--num${c.n === value ? " rv-choice--on" : ""}`} aria-pressed={c.n === value} onClick={() => onPick?.(c.n)}>
            {c.n ?? "Livre"}{" "}
            <span className="sr-only">·</span>{" "}
            <small>{c.caption}</small>
          </button>
        ))}
      </div>
      {notice && <p className="rv-caption center" role="status" data-testid="aviso-plano-poses">{notice}</p>}
      <div className="rv-group">
        <div className="rv-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-9 9" />
          </svg>
          <div className="rv-row__text">
            Fotos do rolo da câmera
            <span className="rv-row__meta">Até {rollLimit} fotos enviadas depois do fim</span>
          </div>
          <span className={`rv-toggle${roll ? " rv-toggle--on" : ""}`} role="switch" aria-checked={roll} aria-label="Fotos do rolo da câmera" tabIndex={0} style={{ cursor: "pointer" }}
            onClick={() => onRoll?.(!roll)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onRoll?.(!roll); } }} />
        </div>
      </div>
    </WizardSheet>
  );
}
