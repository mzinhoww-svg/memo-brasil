"use client";
/* Camera-revelacao.html (passo 5): mesmo markup e classes da referência; dados reais por props (padrão = desenho). */
import { WizardSheet } from "../WizardSheet";

export interface RevealChoiceView { id: string; label: string; small: string }
export const REVEAL_CHOICES_REF: RevealChoiceView[] = [
  { id: "ao-acabar", label: "Quando a festa acabar", small: "dom 02:00" },
  { id: "manha", label: "No dia seguinte", small: "dom 12:00" },
  { id: "um-dia", label: "Um dia depois", small: "seg 02:00" },
  { id: "dia", label: "Escolher dia e hora", small: " " },
];

export interface CameraRevelacaoProps {
  /** Rótulos curtos da linha do tempo: "sáb 16:30", "dom 02:00", "dom 12:00". */
  startLabel?: string; endLabel?: string; revealLabel?: string;
  choices?: RevealChoiceView[]; value?: string;
  /** Linha final: "Todo mundo recebe o aviso no domingo, 15 de março, às 12:00." */
  notice?: string; error?: string; busy?: boolean;
  /** Campo "Escolher dia e hora" (aaaa-mm-ddTHH:MM), só usado quando value = "dia". */
  custom?: string; customMin?: string;
  onPick?: (id: string) => void; onCustom?: (v: string) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraRevelacao({
  startLabel = "sáb 16:30", endLabel = "dom 02:00", revealLabel = "dom 12:00", choices = REVEAL_CHOICES_REF, value = "manha",
  notice = "Todo mundo recebe o aviso no domingo, 15 de março, às 12:00.", error, busy, custom = "", customMin, onPick, onCustom, onBack, onNext,
}: CameraRevelacaoProps = {}) {
  return (
    <WizardSheet step={5} title="Quando revelar?" caption="Depois que o filme fecha, as fotos ficam no laboratório. Ninguém vê até a revelação, nem quem tirou." onBack={onBack} onNext={onNext} busy={busy}>
      <div className="tline">
        <div className="tl-p">
          <i />
          <b>Festa</b>
          <span>{startLabel}</span>
        </div>
        <div className="tl-p">
          <i />
          <b>Filme fecha</b>
          <span>{endLabel}</span>
        </div>
        <div className="tl-p on">
          <i />
          <b>Revela</b>
          <span>{revealLabel}</span>
        </div>
      </div>
      <div className="rv-choices rv-choices--stack" style={{ gridTemplateColumns: "1fr 1fr", alignSelf: "stretch" }} role="group" aria-label="Quando revelar">
        {choices.map((c) => (
          <button key={c.id} type="button" className={`rv-choice${c.id === value ? " rv-choice--on" : ""}`} aria-pressed={c.id === value} onClick={() => onPick?.(c.id)}>
            {c.label}
            <small>{c.small}</small>
          </button>
        ))}
      </div>
      {value === "dia" && (
        <input type="datetime-local" className="rv-sr-only" aria-label="Dia e hora da revelação" value={custom} min={customMin} onChange={(e) => onCustom?.(e.target.value)} ref={(el) => { if (el && !custom) { try { el.showPicker(); } catch { /* sem showPicker: o campo continua no teclado */ } } }} />
      )}
      {error && <p className="rv-caption center" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      <p className="rv-caption center">{notice}</p>
    </WizardSheet>
  );
}
