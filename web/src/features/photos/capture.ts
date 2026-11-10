import type { CameraStyle, FilmLook } from "@/domain/options";
import type { PhotoData } from "@/repositories";

/** Estilo da câmera aplicado nos pixels (RGBA). Funciona em todos os navegadores (sem ctx.filter). */
export function applyStylePixels(px: Uint8ClampedArray, style: CameraStyle | FilmLook): void {
  if (style === "filme35") return applyFilmTone(px);
  if (style === "original" || style === "natural" || style === "festa" || style === "casamento" || style === "aniversario" || style === "noite") return;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (style === "preto-e-branco") {
      const v = (gray - 128) * 1.1 + 128;
      px[i] = px[i + 1] = px[i + 2] = v;
    } else {
      // vintage / Filme 35mm: dessatura 35%, tom quente, contraste suave e pretos levantados
      const mix = (c: number) => gray * 0.35 + c * 0.65;
      px[i] = (mix(r) - 128) * 1.05 + 128 + 14;
      px[i + 1] = (mix(g) - 128) * 1.05 + 128 + 4;
      px[i + 2] = (mix(b) - 128) * 1.05 + 128 - 12;
      for (let k = 0; k < 3; k++) px[i + k] = px[i + k] * 0.94 + 10;
    }
  }
}

/** Tom do Filme 35mm: dessatura 25%, contraste mais firme, quente (vermelho +, azul −) e pretos levantados. */
export const FILM_TONE = { desat: 0.25, contrast: 1.12, shift: [18, 5, -18] as const, lift: 10, gain: 0.94 };
function applyFilmTone(px: Uint8ClampedArray): void {
  const { desat, contrast, shift, lift, gain } = FILM_TONE;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    for (let k = 0; k < 3; k++) {
      const c = gray * desat + px[i + k] * (1 - desat);
      px[i + k] = ((c - 128) * contrast + 128 + shift[k]) * gain + lift;
    }
  }
}

/** Filme 35mm sobre os pixels: brilho de flash no centro, vinheta nos cantos e grão de filme (determinístico por `seed`). */
export const FILM_FX = { flash: 16, vignette: 0.3, grain: 11 };
export function applyFilmEffects(px: Uint8ClampedArray, w: number, h: number, seed = 1): void {
  const { flash, vignette, grain } = FILM_FX;
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cx = w / 2, cy = h * 0.45, rMax = Math.hypot(w / 2, h / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.min(1, Math.hypot(x - cx, y - cy) / rMax);
      const glow = flash * Math.max(0, 1 - d * 1.6) ** 2; // hotspot do flash, quente
      const dim = 1 - vignette * d ** 2.2;
      const n = (rnd() - 0.5) * 2 * grain;
      px[i] = (px[i] + glow * 1.1) * dim + n;
      px[i + 1] = (px[i + 1] + glow) * dim + n;
      px[i + 2] = (px[i + 2] + glow * 0.8) * dim + n;
    }
  }
}

export const MAX_SIDE = 1600;

/** Carimbo de data do Filme 35mm (`'27 03 14`), canto inferior direito, em laranja. A cor é a do carimbo da câmera física. */
export function stampText(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `'${p(d.getFullYear() % 100)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
}
function stampDate(ctx: CanvasRenderingContext2D, w: number, h: number, d: Date) {
  const size = Math.max(14, Math.round(Math.min(w, h) * 0.035));
  ctx.save();
  ctx.font = `${size}px "Share Tech Mono", ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const stamp = getComputedStyle(document.documentElement).getPropertyValue("--carimbo").trim() || "orange";
  ctx.shadowColor = stamp;
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = stamp;
  ctx.fillText(stampText(d), w - size, h - size);
  ctx.restore();
}

/** Desenha a fonte (vídeo ou imagem) num canvas reduzido, aplica o estilo e devolve JPEG em bytes. */
export async function renderPhoto(source: CanvasImageSource, width: number, height: number, style: CameraStyle | FilmLook, mirror = false, takenAt: Date = new Date()): Promise<PhotoData> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponivel");
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, w, h);
  if (style !== "original" && style !== "natural") {
    const img = ctx.getImageData(0, 0, w, h);
    applyStylePixels(img.data, style);
    if (style === "filme35") applyFilmEffects(img.data, w, h, takenAt.getTime());
    ctx.putImageData(img, 0, 0);
  }
  if (style === "filme35") stampDate(ctx, w, h, takenAt);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
  return { bytes: await blob.arrayBuffer(), type: "image/jpeg" };
}

export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem invalida"));
    };
    img.src = url;
  });
}

/** Navegadores embutidos de apps (Instagram, Facebook, WhatsApp) costumam negar a câmera: a saída é abrir no navegador. */
export function isEmbeddedBrowser(ua: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|WhatsApp/i.test(ua);
}

/** Passos para liberar a câmera depois de negada, conforme o navegador. */
export function cameraHelp(ua: string): { browser: string; steps: [string, string, string] } {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  if (ios) return { browser: "Safari no iPhone", steps: ["Toque em aA ao lado do endereço.", "Ajustes do site › Câmera › Permitir.", "Volte aqui e toque abaixo."] };
  const android = /Android/i.test(ua);
  return { browser: android ? "Chrome no Android" : "Chrome", steps: ["Toque no cadeado ao lado do endereço.", "Permissões › Câmera › Permitir.", "Volte aqui e toque abaixo."] };
}

export function cameraFailure(error: unknown): "negada" | "sem-camera" | "camera-ocupada" | "camera-interrompida" {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "negada";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "sem-camera";
  if (name === "NotReadableError" || name === "TrackStartError") return "camera-ocupada";
  return "camera-interrompida";
}

export function photoAudienceCopy(everyoneSeesAll: boolean, revealed: boolean): string {
  const audience = everyoneSeesAll ? "todos do evento" : "você e o organizador";
  return revealed ? `A foto pode ser vista por ${audience}.` : `A foto fica guardada até a revelação, inclusive para você. Na revelação, pode ser vista por ${audience}.`;
}
