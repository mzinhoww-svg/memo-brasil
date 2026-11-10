"use client";
/* Camera-embalagem.html (passo 1): mesmo markup e classes da referência; dados reais por props (padrão = desenho). */
import { WRAPS, WRAP_INFO, type Wrap } from "@/domain/options";
import { WizardSheet } from "../WizardSheet";

export interface CameraEmbalagemProps {
  wrap?: Wrap; busy?: boolean;
  onPick?: (w: Wrap) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraEmbalagem({ wrap = "casamento", busy, onPick, onBack, onNext }: CameraEmbalagemProps = {}) {
  const info = WRAP_INFO[wrap];
  return (
    <WizardSheet step={1} title="Escolha a embalagem" caption="É a cara da câmera: aparece no convite, no QR e na tela de cada convidado." onBack={onBack} onNext={onNext} busy={busy}>
      <div className="rv-stagebox" style={{ margin: "0 -20px" }}>
        <img src={`/revela/ref/cam-${wrap}.webp`} alt={`Câmera com embalagem ${info.label}`} style={{ width: "360px" }} />
      </div>
      <div className="wrapname">
        <span className="rv-title">{info.label}</span>
        <span className="rv-caption">{info.blurb}</span>
      </div>
      <div className="rv-wraps" role="radiogroup" aria-label="Embalagem">
        {WRAPS.map((w) => (
          <button key={w} type="button" role="radio" aria-checked={w === wrap} className={`rv-wrap${w === wrap ? " rv-wrap--on" : ""}`} onClick={() => onPick?.(w)}>
            <span className={`rv-wrap__sw sw-${w}`} />
            {WRAP_INFO[w].label}
          </button>
        ))}
      </div>
    </WizardSheet>
  );
}
