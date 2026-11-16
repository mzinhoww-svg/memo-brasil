import { WRAP_INFO, wrapOf, type CameraStyle, type Wrap } from "@/domain/options";
import HOMOGRAPHY from "./camera-label-h.json";

/**
 * Câmera 3D da embalagem sobre o palco escuro, com os dados do evento impressos na embalagem.
 * Os renders (design-system/revela/3d/clean) saem sem os textos de exemplo; nome, data e poses entram aqui,
 * projetados na frente da câmera pela homografia textura → render (design-system/revela/codigo/homografia-embalagem.py).
 * Coordenadas e tamanhos dos textos são os da textura em design-system/revela/codigo/blender/wraps.py (2600 × 1400).
 */
export interface CameraPrint {
  /** Nome do evento (impresso grande na embalagem Casamento; em caixa alta no carimbo da Aniversário). */
  name?: string;
  /** Linha fina sob o nome, ex.: "14 · 03 · 2027". */
  date?: string;
  /** Poses por pessoa; `null` = livre. */
  poses?: number | null;
  /** Carimbo à direita da faixa (ex.: "REVELA DOM 12:00"). */
  stamp?: string;
}

type Txt = { x: number; y: number; size: number; family: "display" | "sans" | "stamp"; weight?: number; anchor?: "start" | "end"; ls?: number; color: string; text: string; maxWidth: number; blend?: boolean };

const posesText = (p: number | null | undefined) => (p === null ? "poses livres" : `${p ?? 27} poses`);
const upper = (s: string) => s.toLocaleUpperCase("pt-BR");

function texts(wrap: Wrap, p: CameraPrint): Txt[] {
  const name = (p.name ?? "").trim();
  switch (wrap) {
    case "casamento":
      return [
        { x: 1020, y: 760, size: 250, family: "display", color: "var(--wrap-casamento-ink)", text: name || "Seu evento", maxWidth: 1540, blend: true },
        { x: 1030, y: 900, size: 60, family: "sans", weight: 500, color: "var(--wrap-casamento-sub)", text: [p.date, "câmera dos convidados"].filter(Boolean).join(" · "), maxWidth: 1520, blend: true },
        { x: 2520, y: 1250, size: 60, family: "stamp", anchor: "end", ls: 6, color: "var(--wrap-casamento-ink)", text: upper(posesText(p.poses)), maxWidth: 700, blend: true },
      ];
    case "festa":
      return [
        { x: 1010, y: 1000, size: 62, family: "sans", weight: 600, color: "var(--wrap-festa-ink)", text: `câmera do evento · ${posesText(p.poses)} · ISO 400`, maxWidth: 1540, blend: true },
        ...(p.stamp ? [{ x: 2520, y: 1250, size: 58, family: "stamp" as const, anchor: "end" as const, ls: 6, color: "var(--wrap-festa-stamp)", text: upper(p.stamp), maxWidth: 1000 }] : []),
      ];
    case "aniversario":
      return [
        { x: 1010, y: 990, size: 62, family: "sans", weight: 600, color: "var(--wrap-aniversario-ink)", text: `aniversário · ${posesText(p.poses)}`, maxWidth: 1540 },
        ...(name ? [{ x: 2520, y: 1250, size: 58, family: "stamp" as const, anchor: "end" as const, ls: 6, color: "var(--wrap-aniversario-stamp)", text: upper(name), maxWidth: 1050 }] : []),
      ];
    case "noite":
      return [{ x: 1010, y: 990, size: 62, family: "sans", weight: 600, color: "var(--wrap-noite-ink)", text: `${name ? name.toLocaleLowerCase("pt-BR") : "noite"} · ${posesText(p.poses)} · flash`, maxWidth: 1540 }];
  }
}

/** Afim local da homografia no ponto (x, y): mapeia coordenadas do texto (origem na âncora) para o render 1200 × 1200. */
function localMatrix(h: number[][], x: number, y: number): string {
  const [[a, b, c], [d, e, f], [g, hh, i]] = h;
  const w = g * x + hh * y + i;
  const X = (a * x + b * y + c) / w;
  const Y = (d * x + e * y + f) / w;
  const m = [(a - X * g) / w, (d - Y * g) / w, (b - X * hh) / w, (e - Y * hh) / w, X, Y];
  return `matrix(${m.map((v) => +v.toFixed(6)).join(" ")})`;
}

const FAMILY = { display: "var(--font-display)", sans: "var(--font-sans)", stamp: "var(--font-stamp)" } as const;
const CHAR_W = { display: 0.5, sans: 0.52, stamp: 0.6 } as const;

export function CameraStage({ wrap, size = 640, priority = false, label, className, print }: { wrap?: CameraStyle | null; size?: 360 | 640 | 960; priority?: boolean; label?: string; className?: string; print?: CameraPrint }) {
  const w = wrapOf(wrap);
  const base = `/revela/3d/cam-${w}`;
  const h = (HOMOGRAPHY as Record<Wrap, number[][]>)[w];
  return (
    <div className={`rvl-stagebox ${className ?? ""}`} data-wrap={w}>
      <div className="rvl-stagebox__obj">
        <picture>
          <source type="image/avif" srcSet={`${base}-640.avif`} />
          <img
            src={`${base}-${size}.webp`}
            srcSet={`${base}-360.webp 360w, ${base}-640.webp 640w, ${base}-960.webp 960w`}
            sizes="(max-width: 480px) 90vw, 480px"
            width={size}
            height={size}
            alt={label ?? `Câmera ${WRAP_INFO[w].label}${print?.name ? ` de ${print.name}` : ""}`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
          />
        </picture>
        <svg className="rvl-stagebox__print" viewBox="0 0 1200 1200" aria-hidden="true" focusable="false">
          {texts(w, print ?? {}).map((t, k) => {
            const est = t.text.length * t.size * CHAR_W[t.family] + (t.ls ?? 0) * t.text.length;
            return (
              <text key={k} transform={localMatrix(h, t.x, t.y)} textAnchor={t.anchor ?? "start"}
                style={{ fill: t.color, fontFamily: FAMILY[t.family], fontSize: t.size, fontWeight: t.weight ?? 400, letterSpacing: t.ls ?? 0, mixBlendMode: t.blend ? "multiply" : "normal" }}
                {...(est > t.maxWidth ? { textLength: t.maxWidth, lengthAdjust: "spacingAndGlyphs" } : {})}>
                {t.text}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
