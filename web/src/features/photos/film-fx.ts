/** Efeitos de filme depois da LUT: halation nos realces, grão (determinístico por foto) e vinheta. Puro (sem DOM): roda no teste e no script. */
import { applyLutPixels } from "./film-lut.ts";

/** halation = força do brilho avermelhado em volta dos realces; vignette = escurecimento nos cantos; grain = amplitude (0..255). */
export const FILM_FX = { halation: 0.34, halationThreshold: 0.7, vignette: 0.28, grain: 9 };

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Halation: o brilho dos realces vaza em volta, laranja-avermelhado (a emulsão reflete a luz no verso do filme). */
export function applyHalation(px: Uint8ClampedArray, w: number, h: number): void {
  const { halation, halationThreshold: th } = FILM_FX;
  const blk = Math.max(2, Math.round(Math.max(w, h) / 200));
  const bw = Math.ceil(w / blk), bh = Math.ceil(h / blk);
  let map = new Float32Array(bw * bh);
  const cnt = new Float32Array(bw * bh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const k = Math.floor(y / blk) * bw + Math.floor(x / blk);
    map[k] += l > th ? ((l - th) / (1 - th)) ** 1.5 : 0;
    cnt[k]++;
  }
  for (let k = 0; k < map.length; k++) map[k] /= cnt[k] || 1;
  // desfoque em caixa (3 passadas separáveis) no mapa reduzido
  const radius = 2;
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(map.length);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let s = 0; for (let d = -radius; d <= radius; d++) s += map[y * bw + Math.min(bw - 1, Math.max(0, x + d))]; tmp[y * bw + x] = s / (2 * radius + 1); }
    const out = new Float32Array(map.length);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let s = 0; for (let d = -radius; d <= radius; d++) s += tmp[Math.min(bh - 1, Math.max(0, y + d)) * bw + x]; out[y * bw + x] = s / (2 * radius + 1); }
    map = out;
  }
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / blk - 0.5)), y0 = Math.floor(fy), y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / blk - 0.5)), x0 = Math.floor(fx), x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
      const g = (map[y0 * bw + x0] * (1 - tx) + map[y0 * bw + x1] * tx) * (1 - ty) + (map[y1 * bw + x0] * (1 - tx) + map[y1 * bw + x1] * tx) * ty;
      const a = g * halation * 255, i = (y * w + x) * 4;
      px[i] += a; px[i + 1] += a * 0.42; px[i + 2] += a * 0.16;
    }
  }
}

/** Vinheta e grão: o grão é mais forte nos meios-tons e igual para a mesma `seed` (a foto). */
export function applyGrainVignette(px: Uint8ClampedArray, w: number, h: number, seed = 1): void {
  const { vignette, grain } = FILM_FX;
  const rnd = seeded(seed);
  const cx = w / 2, cy = h / 2, rMax = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const d = Math.min(1, Math.hypot(x - cx, y - cy) / rMax);
    const dim = 1 - vignette * d ** 2.2;
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const n = (rnd() - 0.5) * 2 * grain * (0.45 + 0.55 * 4 * l * (1 - l));
    px[i] = px[i] * dim + n; px[i + 1] = px[i + 1] * dim + n; px[i + 2] = px[i + 2] * dim + n;
  }
}

/** O Filme 35mm completo sobre pixels RGBA: LUT 3D → halation → vinheta e grão. (O carimbo é desenhado no canvas.) */
export function applyFilmLook(px: Uint8ClampedArray, w: number, h: number, seed = 1): void {
  applyLutPixels(px);
  applyHalation(px, w, h);
  applyGrainVignette(px, w, h, seed);
}
