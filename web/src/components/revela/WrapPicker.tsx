"use client";

import { WRAPS, WRAP_INFO, wrapOf, type CameraStyle, type Wrap } from "@/domain/options";

/** Seletor das 4 embalagens: amostras de material (a textura impressa), não bolinhas de cor. */
export function WrapPicker({ value, onChange, disabled }: { value: CameraStyle | null | undefined; onChange: (w: Wrap) => void; disabled?: boolean }) {
  const current = wrapOf(value);
  return (
    <div className="rv-wraps" role="radiogroup" aria-label="Embalagem da câmera">
      {WRAPS.map((w) => (
        <button
          key={w}
          type="button"
          role="radio"
          aria-checked={current === w}
          disabled={disabled}
          className="rv-wrap"
          onClick={() => onChange(w)}
        >
          <span className="rv-wrap__sw" aria-hidden="true" style={{ backgroundImage: `url(/revela/embalagens/wrap-${w}.webp)` }} />
          {WRAP_INFO[w].label}
        </button>
      ))}
    </div>
  );
}
