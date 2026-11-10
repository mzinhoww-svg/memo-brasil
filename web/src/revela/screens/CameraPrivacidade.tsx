"use client";
/* Camera-privacidade.html (passo 7): mesmo markup da referência; toggles por props (padrão = desenho). */
import { WizardSheet } from "../WizardSheet";

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange?: (v: boolean) => void }) {
  return (
    <span className={`rv-toggle${on ? " rv-toggle--on" : ""}`} role="switch" aria-checked={on} aria-label={label} tabIndex={0} style={{ cursor: "pointer" }}
      onClick={() => onChange?.(!on)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange?.(!on); } }} />
  );
}

export interface CameraPrivacidadeProps {
  /** Convidados veem o feed (campo real: everyoneSeesAll). */
  feed?: boolean;
  /** "Permitir baixar em alta": o evento não tem esse campo; vale só no assistente (divergência no CHECKLIST). */
  download?: boolean;
  busy?: boolean;
  onFeed?: (v: boolean) => void; onDownload?: (v: boolean) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraPrivacidade({ feed = true, download = true, busy, onFeed, onDownload, onBack, onNext }: CameraPrivacidadeProps = {}) {
  return (
    <WizardSheet step={7} title="Quem vê o quê" caption="Você vê tudo e pode tirar qualquer foto antes da revelação." onBack={onBack} onNext={onNext} busy={busy}>
      <div className="privviz">
        <div className="rv-print" style={{ position: "absolute", left: "30px", top: "10px", width: "120px", height: "150px", transform: "rotate(-7deg)", zIndex: 1 }}>
          <img src="/revela/ref/sc-baloes.jpg" alt="Foto de convidado" />
        </div>
        <div className="rv-print" style={{ position: "absolute", left: "130px", top: "0px", width: "120px", height: "150px", transform: "rotate(4deg)", zIndex: 2 }}>
          <img src="/revela/ref/sc-aliancas.jpg" alt="Foto de convidado" />
        </div>
        <div className="rv-print" style={{ position: "absolute", left: "232px", top: "16px", width: "120px", height: "150px", transform: "rotate(-2deg)", zIndex: 1 }}>
          <img src="/revela/ref/sc-camera.jpg" alt="Foto de convidado" />
        </div>
      </div>
      <div className="rv-group">
        <div className="rv-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <div className="rv-row__text">
            Convidados veem o feed
            <span className="rv-row__meta">Curtem e comentam depois da revelação</span>
          </div>
          <Toggle on={feed} label="Convidados veem o feed" onChange={onFeed} />
        </div>
        <div className="rv-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </svg>
          <div className="rv-row__text">Permitir baixar em alta</div>
          <Toggle on={download} label="Permitir baixar em alta" onChange={onDownload} />
        </div>
      </div>
    </WizardSheet>
  );
}
