/**
 * Revela · Filme 35mm no canvas
 * Desenha a foto, aplica o filme e carimba a data. É o que a captura e o editor chamam.
 */
import { applyFilm, type FilmLook, type FilmOptions } from "./film35";

export type RenderOptions = Omit<FilmOptions, "look"> & {
  /** "natural" não aplica filme (só desenha). */
  look?: FilmLook | "natural";
  /** Espelha na horizontal (câmera frontal). */
  mirror?: boolean;
  /** Texto do carimbo, ex.: "'27 03 14". Sem texto, não carimba. */
  stamp?: string;
};

/** Carimbo laranja de data no canto inferior direito, com o brilho de LED das câmeras de filme. */
export function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, text: string): void {
  const size = Math.max(14, Math.round(Math.min(w, h) * 0.045));
  ctx.save();
  ctx.font = `${size}px "Share Tech Mono", ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "#FFA23A";
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = "#FFA23A";
  ctx.fillText(text, w - size, h - size);
  ctx.shadowBlur = 0;
  ctx.fillText(text, w - size, h - size);
  ctx.restore();
}

/**
 * Desenha `source` em `canvas` (cobrindo o quadro), aplica o filme e o carimbo.
 * Para fotos grandes, chame fora do caminho do toque (depois do flash) ou em um worker com OffscreenCanvas.
 */
export function renderFilm(canvas: HTMLCanvasElement | OffscreenCanvas, source: CanvasImageSource, sw: number, sh: number, opts: RenderOptions = {}): void {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("canvas 2d indisponível");
  const s = Math.max(w / sw, h / sh);
  ctx.save();
  if (opts.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
  ctx.restore();
  if (opts.look !== "natural") {
    const img = ctx.getImageData(0, 0, w, h);
    const look: FilmLook = opts.look ?? "filme35";
    applyFilm(img.data, w, h, { seed: opts.seed, grainOffset: opts.grainOffset, halation: opts.halation, vignette: opts.vignette, grain: opts.grain, look });
    ctx.putImageData(img, 0, 0);
  }
  if (opts.stamp) drawStamp(ctx, w, h, opts.stamp);
}

/** Carimbo no formato das câmeras de filme: '27 03 14 */
export function stampText(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `'${p(d.getFullYear() % 100)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
}
