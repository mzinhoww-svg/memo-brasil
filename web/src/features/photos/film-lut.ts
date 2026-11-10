/**
 * LUT 3D do "Filme 35mm": negativo colorido tipo Portra/Kodak Gold.
 * Tudo aqui é determinístico e sem dependências do navegador (roda no Node, no teste e no script que gera o .cube).
 * Sintaxe apenas "apagável" (sem enum), para o script `scripts/gen-film-lut.mjs` importar este arquivo direto.
 *
 * Valores 0..1 em sRGB (gama). A tabela fica em Float32Array com o canal R variando mais rápido (ordem do .cube):
 * índice = ((b * N + g) * N + r) * 3.
 */
export const LUT_SIZE = 33;

/** Parâmetros do look. Ajuste aqui, rode `npm run gen:lut` e veja docs/qa/FILTRO-35MM.md. */
export const FILM_LUT_PARAMS = {
  /** Curva em S: 0 = linear, 1 = smoothstep completo. */
  sCurve: 0.42,
  /** Pretos levantados (somados no preto, somem no branco), por canal R,G,B: levemente verde-azulados. */
  lift: [0.022, 0.036, 0.042] as const,
  /** Fade: o branco puro vira (1 - fade) e o realce perde um pouco de brilho. */
  fade: 0.035,
  /** Saturação geral (1 = igual). */
  saturation: 0.9,
  /** Quanto a mais os verdes perdem de saturação (0..1). */
  greenDesat: 0.38,
  /** Matiz dos verdes puxado para o amarelado (0..1, empurra G para R). */
  greenToYellow: 0.05,
  /** Tom somado nos realces (peso: luminância de 0,45 a 1), R,G,B: âmbar. */
  highlightTint: [0.045, 0.02, -0.045] as const,
  /** Tom somado nas sombras (peso: luminância de 0,5 a 0), R,G,B: verde-azulado. */
  shadowTint: [-0.012, 0.008, 0.02] as const,
  /** Realce de calor em peles (tons com R > G > B, saturação média): soma em R e tira de B. */
  skinWarmth: 0.03,
} as const;

export type FilmLutParams = typeof FILM_LUT_PARAMS;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lumaOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** O look em si: uma cor de entrada (0..1) vira a cor de saída (0..1). */
export function filmColor(r: number, g: number, b: number, p: FilmLutParams = FILM_LUT_PARAMS): [number, number, number] {
  // 1) saturação: geral e extra nos verdes; verdes também vão um pouco para o amarelo
  const y0 = lumaOf(r, g, b);
  const greenness = clamp01((g - Math.max(r, b)) * 4);
  const sat = p.saturation * (1 - p.greenDesat * greenness);
  let R = y0 + (r - y0) * sat;
  let G = y0 + (g - y0) * sat;
  let B = y0 + (b - y0) * sat;
  G -= (G - R) * p.greenToYellow * greenness;
  // 2) calor nas peles: R > G > B, saturação média
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const chroma = mx - mn;
  const skin = R > G && G > B ? smooth(0.04, 0.2, chroma) * (1 - smooth(0.45, 0.7, chroma)) * smooth(0.2, 0.5, y0) : 0;
  R += p.skinWarmth * skin;
  B -= p.skinWarmth * skin * 0.8;
  // 3) curva em S suave por canal
  const s = (x: number) => { const c = clamp01(x); return c + p.sCurve * (c * c * (3 - 2 * c) - c); };
  R = s(R); G = s(G); B = s(B);
  // 4) tons: sombras verde-azuladas, realces âmbar
  const y1 = lumaOf(R, G, B);
  const wh = smooth(0.45, 1, y1), ws = 1 - smooth(0, 0.5, y1);
  R += p.highlightTint[0] * wh + p.shadowTint[0] * ws;
  G += p.highlightTint[1] * wh + p.shadowTint[1] * ws;
  B += p.highlightTint[2] * wh + p.shadowTint[2] * ws;
  // 5) pretos levantados e fade (mapa linear lift..1-fade)
  const top = 1 - p.fade;
  R = p.lift[0] + (top - p.lift[0]) * R;
  G = p.lift[1] + (top - p.lift[1]) * G;
  B = p.lift[2] + (top - p.lift[2]) * B;
  return [clamp01(R), clamp01(G), clamp01(B)];
}

/** Constrói a tabela N×N×N×3 (determinística). */
export function buildFilmLut(size = LUT_SIZE, p: FilmLutParams = FILM_LUT_PARAMS): Float32Array {
  const lut = new Float32Array(size ** 3 * 3);
  const k = 1 / (size - 1);
  let o = 0;
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const [R, G, B] = filmColor(r * k, g * k, b * k, p);
    lut[o++] = R; lut[o++] = G; lut[o++] = B;
  }
  return lut;
}

let cached: Float32Array | undefined;
/** A LUT padrão, construída uma vez. */
export function getFilmLut(): Float32Array {
  return (cached ??= buildFilmLut());
}

/** Interpolação trilinear numa LUT (entrada e saída 0..1). */
export function sampleLut(lut: Float32Array, r: number, g: number, b: number, size = LUT_SIZE, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const m = size - 1;
  const fr = clamp01(r) * m, fg = clamp01(g) * m, fb = clamp01(b) * m;
  const r0 = Math.min(m - 1, Math.floor(fr)), g0 = Math.min(m - 1, Math.floor(fg)), b0 = Math.min(m - 1, Math.floor(fb));
  const tr = fr - r0, tg = fg - g0, tb = fb - b0;
  const base = ((b0 * size + g0) * size + r0) * 3;
  const dr = 3, dg = size * 3, db = size * size * 3;
  for (let c = 0; c < 3; c++) {
    const i = base + c;
    const c00 = lut[i] * (1 - tr) + lut[i + dr] * tr;
    const c10 = lut[i + dg] * (1 - tr) + lut[i + dg + dr] * tr;
    const c01 = lut[i + db] * (1 - tr) + lut[i + db + dr] * tr;
    const c11 = lut[i + db + dg] * (1 - tr) + lut[i + db + dg + dr] * tr;
    const c0 = c00 * (1 - tg) + c10 * tg, c1 = c01 * (1 - tg) + c11 * tg;
    out[c] = c0 * (1 - tb) + c1 * tb;
  }
  return out;
}

/** Aplica a LUT em pixels RGBA (0..255), no lugar. O alfa não muda. */
export function applyLutPixels(px: Uint8ClampedArray, lut: Float32Array = getFilmLut(), size = LUT_SIZE): void {
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < px.length; i += 4) {
    sampleLut(lut, px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, size, out);
    px[i] = out[0] * 255 + 0.5;
    px[i + 1] = out[1] * 255 + 0.5;
    px[i + 2] = out[2] * 255 + 0.5;
  }
}

/**
 * Tira 2D (N² × N) RGBA8 para a prévia WebGL: x = b * N + r, y = g. Dentro de cada fatia de azul, R e G são
 * interpolados pela GPU; entre fatias o shader interpola o azul — o mesmo trilinear de `sampleLut`.
 */
export function lutToStrip(lut: Float32Array, size = LUT_SIZE): Uint8Array {
  const w = size * size;
  const data = new Uint8Array(w * size * 4);
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const s = ((b * size + g) * size + r) * 3;
    const d = (g * w + b * size + r) * 4;
    data[d] = Math.round(lut[s] * 255); data[d + 1] = Math.round(lut[s + 1] * 255); data[d + 2] = Math.round(lut[s + 2] * 255); data[d + 3] = 255;
  }
  return data;
}

/** Texto no formato Adobe/Resolve `.cube` (LUT_3D_SIZE, DOMAIN_MIN/MAX e N³ linhas "R G B"). */
export function lutToCube(lut: Float32Array, title = "Revela Filme 35mm", size = LUT_SIZE): string {
  const lines = [`TITLE "${title}"`, `# LUT 3D ${size}x${size}x${size} gerada por web/scripts/gen-film-lut.mjs (web/src/features/photos/film-lut.ts)`, `LUT_3D_SIZE ${size}`, "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"];
  for (let i = 0; i < lut.length; i += 3) lines.push(`${lut[i].toFixed(6)} ${lut[i + 1].toFixed(6)} ${lut[i + 2].toFixed(6)}`);
  return lines.join("\n") + "\n";
}
