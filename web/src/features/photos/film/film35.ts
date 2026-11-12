/**
 * Revela · Filme 35mm
 * Aplica o filme nos pixels (RGBA) de uma foto: halação -> LUT 3D -> vinheta -> grão.
 * Puro (sem canvas, sem DOM): roda igual no navegador, no worker e nos testes.
 * A receita de cor mora em f35/grade.py; este arquivo só aplica o LUT gerado por ela.
 */
import { LUT_FILME35_B64, LUT_PB_B64, LUT_SIZE } from "./film35-lut";

export type FilmLook = "filme35" | "pb";
export type FilmOptions = {
  look?: FilmLook;
  /** Muda o desenho do grão. Use um número por foto (ex.: o horário do disparo). */
  seed?: number;
  /** Brilho vermelho em volta das luzes fortes. 0 desliga. */
  halation?: number;
  /** Escurecimento dos cantos. 0 desliga. */
  vignette?: number;
  /** Força do grão. 0 desliga. */
  grain?: number;
};
export const FILM_DEFAULTS = { halation: 0.85, vignette: 0.3, grain: 0.03 } as const;

const luts: Partial<Record<FilmLook, Uint8Array>> = {};
function lut(look: FilmLook): Uint8Array {
  let t = luts[look];
  if (!t) {
    const bin = atob(look === "pb" ? LUT_PB_B64 : LUT_FILME35_B64);
    t = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) t[i] = bin.charCodeAt(i);
    luts[look] = t;
  }
  return t;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TILE = 256;
const tiles = new Map<number, Float32Array>();
/** Ladrilho de grão 256×256, média 0 e desvio 1, levemente borrado para não parecer ruído digital. */
export function grainTile(seed: number): Float32Array {
  const hit = tiles.get(seed);
  if (hit) return hit;
  const rnd = mulberry32(seed);
  const raw = new Float64Array(TILE * TILE);
  for (let i = 0; i < raw.length; i++) raw[i] = rnd() + rnd() + rnd() + rnd() - 2;
  const out = new Float32Array(TILE * TILE);
  let sq = 0;
  const tmp = new Float64Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          // np.roll(t, d): saída[i] = t[i - d]
          const v = raw[((y - dy + TILE) & 255) * TILE + ((x - dx + TILE) & 255)];
          s += v * (dy === 0 ? 2 : 1) * (dx === 0 ? 2 : 1);
        }
      }
      s /= 16;
      tmp[y * TILE + x] = s;
      sq += s * s;
    }
  }
  const k = 1 / Math.sqrt(sq / tmp.length);
  for (let i = 0; i < tmp.length; i++) out[i] = tmp[i] * k;
  if (tiles.size > 8) tiles.clear();
  tiles.set(seed, out);
  return out;
}

/** Média móvel separável, borda repetida, 3 passadas. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  let a = src;
  const win = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    const hz = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        hz[row + x] = acc / win;
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    const vt = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += hz[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        vt[y * w + x] = acc / win;
        acc += hz[Math.min(h - 1, y + r + 1) * w + x] - hz[Math.max(0, y - r) * w + x];
      }
    }
    a = vt;
  }
  return a;
}

/** Mapa das luzes fortes, em baixa resolução e borrado: é o que vira o halo vermelho. */
function halationMap(px: Uint8ClampedArray, w: number, h: number): { map: Float32Array; f: number; sw: number; sh: number } {
  const f = Math.max(1, Math.ceil(Math.max(w, h) / 200));
  const sw = Math.floor(w / f), sh = Math.floor(h / f);
  const m = new Float32Array(sw * sh);
  const inv = 1 / (f * f * 255);
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      let acc = 0;
      for (let y = sy * f; y < sy * f + f; y++) {
        let i = (y * w + sx * f) * 4;
        for (let x = 0; x < f; x++, i += 4) acc += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722;
      }
      const t = Math.min(1, Math.max(0, (acc * inv - 0.66) / 0.34));
      m[sy * sw + sx] = t * Math.sqrt(t);
    }
  }
  return { map: boxBlur(m, sw, sh, Math.max(1, Math.round(Math.max(sw, sh) * 0.016))), f, sw, sh };
}

/** Aplica o filme no lugar. `px` é RGBA (o `data` de um ImageData); o alfa não muda. */
export function applyFilm(px: Uint8ClampedArray, w: number, h: number, opts: FilmOptions = {}): void {
  const look = opts.look ?? "filme35";
  const halation = opts.halation ?? FILM_DEFAULTS.halation;
  const vignette = opts.vignette ?? FILM_DEFAULTS.vignette;
  const grain = opts.grain ?? FILM_DEFAULTS.grain;
  const T = lut(look), N = LUT_SIZE, N2 = N * N, S = (N - 1) / 255;
  const hal = halation > 0 ? halationMap(px, w, h) : null;
  const tile = grain > 0 ? grainTile(opts.seed ?? 1) : null;
  const cs = Math.max(1, Math.round(Math.max(w, h) / 1100));
  const hw = w / 2, hh = h / 2;

  for (let y = 0; y < h; y++) {
    // linha do mapa de halação (bilinear)
    let y0 = 0, y1 = 0, fy = 0;
    if (hal) {
      const ys = Math.min(hal.sh - 1, Math.max(0, (y + 0.5) / hal.f - 0.5));
      y0 = Math.floor(ys); y1 = Math.min(y0 + 1, hal.sh - 1); fy = ys - y0;
    }
    const gy = Math.floor(y / cs);
    const dy = (y + 0.5 - hh) / hh;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = px[i], g = px[i + 1], b = px[i + 2];

      if (hal) {
        const xs = Math.min(hal.sw - 1, Math.max(0, (x + 0.5) / hal.f - 0.5));
        const x0 = Math.floor(xs), x1 = Math.min(x0 + 1, hal.sw - 1), fx = xs - x0;
        const m = hal.map;
        const v = (m[y0 * hal.sw + x0] * (1 - fx) + m[y0 * hal.sw + x1] * fx) * (1 - fy) + (m[y1 * hal.sw + x0] * (1 - fx) + m[y1 * hal.sw + x1] * fx) * fy;
        const k = v * halation * 255;
        r += k; g += k * 0.3; b += k * 0.06;
      }

      // LUT 3D, interpolação trilinear
      const vr = Math.min(255, r) * S, vg = Math.min(255, g) * S, vb = Math.min(255, b) * S;
      const r0 = Math.min(Math.floor(vr), N - 2), g0 = Math.min(Math.floor(vg), N - 2), b0 = Math.min(Math.floor(vb), N - 2);
      const fr = vr - r0, fg = vg - g0, fb = vb - b0;
      const o = (r0 + g0 * N + b0 * N2) * 3;
      for (let c = 0; c < 3; c++) {
        const c00 = T[o + c] * (1 - fr) + T[o + 3 + c] * fr;
        const c10 = T[o + N * 3 + c] * (1 - fr) + T[o + N * 3 + 3 + c] * fr;
        const c01 = T[o + N2 * 3 + c] * (1 - fr) + T[o + N2 * 3 + 3 + c] * fr;
        const c11 = T[o + (N2 + N) * 3 + c] * (1 - fr) + T[o + (N2 + N) * 3 + 3 + c] * fr;
        const out = (c00 * (1 - fg) + c10 * fg) * (1 - fb) + (c01 * (1 - fg) + c11 * fg) * fb;
        if (c === 0) r = out; else if (c === 1) g = out; else b = out;
      }

      if (vignette > 0) {
        const dx = (x + 0.5 - hw) / hw;
        const t = Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dy * dy) - 0.45) / 0.8));
        const k = 1 - vignette * t * t * (3 - 2 * t);
        r *= k; g *= k; b *= k;
      }

      if (tile) {
        const gx = Math.floor(x / cs);
        const n1 = tile[(gy & 255) * TILE + (gx & 255)];
        const n2 = tile[((gy + 31) & 255) * TILE + ((gx + 97) & 255)];
        const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
        const q = 2 * Y - 1;
        const amp = grain * 255 * (0.22 + 0.78 * (1 - q * q)) * (1 - 0.55 * Y * Y);
        r += n1 * amp;
        g += (n1 * 0.85 + n2 * 0.15) * amp * 0.92;
        b += (n1 * 0.7 + n2 * 0.3) * amp * 1.08;
      }

      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
  }
}

/** Só a cor de um pixel (sem halação, vinheta e grão). Útil para testes e amostras de cor. */
export function gradeColor(rgb: [number, number, number], look: FilmLook = "filme35"): [number, number, number] {
  const px = new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255]);
  applyFilm(px, 1, 1, { look, halation: 0, vignette: 0, grain: 0 });
  return [px[0], px[1], px[2]];
}
