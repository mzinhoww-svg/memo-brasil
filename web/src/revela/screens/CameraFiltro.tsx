"use client";
/* Camera-filtro.html (passo 6): duas fotos reais lado a lado (natural × Filme 35mm); mesmo markup da referência, escolha por props. */
import { FILM_LABEL, type FilmLook } from "@/domain/options";
import { WizardSheet } from "../WizardSheet";

const FILMS: { id: FilmLook; src: string; alt: string }[] = [
  { id: "natural", src: "/revela/ref/sc-bolo-natural.jpg", alt: "Sem filme" },
  { id: "filme35", src: "/revela/ref/sc-bolo.jpg", alt: "Com filme 35mm" },
];
const CAPTION: Record<FilmLook, string> = {
  filme35: "Filme 35mm: tons quentes, grão, carimbo de data e o brilho do flash.",
  natural: "Natural: a foto como a câmera do celular viu, sem efeito.",
};

export interface CameraFiltroProps {
  /** Amostras mostradas; no app o Filme 35mm é a foto natural passada pela LUT real (`/revela/lut/amostra-bolo-filme35.jpg`). */
  samples?: Partial<Record<FilmLook, string>>;
  film?: FilmLook; busy?: boolean;
  onPick?: (f: FilmLook) => void; onBack?: () => void; onNext?: () => void;
}

export function CameraFiltro({ samples, film = "filme35", busy, onPick, onBack, onNext }: CameraFiltroProps = {}) {
  return (
    <WizardSheet step={6} title="Qual filme?" caption="O filme é aplicado em todas as fotos. Dá para tirar depois." onBack={onBack} onNext={onNext} busy={busy}>
      <div className="compare" role="radiogroup" aria-label="Filme">
        {FILMS.map((f) => (
          <div key={f.id} className={`cmp${film === f.id ? " on" : ""}`} role="radio" aria-checked={film === f.id} aria-label={FILM_LABEL[f.id]} tabIndex={0} style={{ cursor: "pointer" }}
            onClick={() => onPick?.(f.id)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onPick?.(f.id); } }}>
            <img src={samples?.[f.id] ?? f.src} alt={f.alt} />
            <span aria-hidden="true">{FILM_LABEL[f.id]}</span>
          </div>
        ))}
      </div>
      <p className="rv-caption center">{CAPTION[film]}</p>
    </WizardSheet>
  );
}
