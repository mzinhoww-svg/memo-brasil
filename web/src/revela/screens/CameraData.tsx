"use client";
/* Camera-data.html (passo 3): mesmo markup e classes da referência; dados reais por props (padrão = desenho). */
import { useRef } from "react";
import { WizardSheet } from "../WizardSheet";

const CAL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const CLOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const CHEV = (
  <span className="rv-row__end">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  </span>
);

export interface CameraDataProps {
  /** Valores dos campos (aaaa-mm-dd / HH:MM) e rótulos prontos. */
  date?: string; start?: string; end?: string;
  dayLabel?: string; endLabel?: string; cityLabel?: string;
  error?: string; busy?: boolean;
  onDate?: (v: string) => void; onStart?: (v: string) => void; onEnd?: (v: string) => void;
  onBack?: () => void; onNext?: () => void;
  /** Hora mínima do campo de dia (aaaa-mm-dd). */
  minDate?: string;
}

function PickRow({ icon, meta, text, type, value, label, onChange, min, on }: { icon: React.ReactNode; meta: string; text: string; type: "date" | "time"; value: string; label: string; onChange?: (v: string) => void; min?: string; on?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => { const el = ref.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); el.click(); } };
  return (
    <div className={`rv-row${on ? " wrow-on" : ""}`} onClick={open} style={{ cursor: "pointer", position: "relative" }}>
      {icon}
      <div className="rv-row__text">
        <span className="rv-row__meta">{meta}</span>
        {text}
      </div>
      {CHEV}
      <input ref={ref} type={type} value={value} min={min} aria-label={label} tabIndex={-1} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange?.(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
    </div>
  );
}

export function CameraData({
  date = "2027-03-14", start = "16:30", end = "02:00", dayLabel = "sábado, 14 de março de 2027", endLabel = "02:00 · domingo, 15 de março", cityLabel = "Cuiabá",
  error, busy, onDate, onStart, onEnd, onBack, onNext, minDate,
}: CameraDataProps = {}) {
  return (
    <WizardSheet step={3} title="Quando é a festa?" caption="A câmera abre quando a festa começa e fecha quando ela acaba. Os convidados só fotografam nesse intervalo." onBack={onBack} onNext={onNext} busy={busy}>
      <div style={{ alignSelf: "stretch" }}>
        <div className="rv-group">
          <PickRow on icon={CAL} meta="Dia" text={dayLabel} type="date" value={date} label="Dia" onChange={onDate} min={minDate} />
          <PickRow icon={CLOCK} meta="Começa" text={start} type="time" value={start} label="Começa" onChange={onStart} />
          <PickRow icon={CLOCK} meta="Termina" text={endLabel} type="time" value={end} label="Termina" onChange={onEnd} />
        </div>
        <div className="openbar">
          <div className="row between">
            <span className="rv-stamp" style={{ fontSize: "12px" }}>{start}</span>
            <span className="rv-stamp" style={{ fontSize: "12px" }}>{end}</span>
          </div>
          <i><s /></i>
          <div className="row between">
            <span>câmera abre</span>
            <span>filme fecha</span>
          </div>
        </div>
        {error && <p className="rv-caption" role="alert" style={{ marginTop: "10px", color: "var(--danger)" }}>{error}</p>}
        <p className="rv-caption" style={{ marginTop: "10px" }}>Horário de {cityLabel}. Dá para mudar depois nos ajustes.</p>
      </div>
    </WizardSheet>
  );
}
