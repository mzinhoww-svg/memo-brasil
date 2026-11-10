import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LUT_SIZE, applyLutPixels, buildFilmLut, filmColor, getFilmLut, lumaOf, lutToCube, lutToStrip, sampleLut } from "./film-lut";

const N = LUT_SIZE;
const at = (lut: Float32Array, r: number, g: number, b: number) => { const i = ((b * N + g) * N + r) * 3; return [lut[i], lut[i + 1], lut[i + 2]]; };
/** Tolerância dos cantos neutros: o look levanta o preto e cai o branco de propósito, mas no máximo 0,08. */
const TOL = 0.08;

describe("LUT do Filme 35mm", () => {
  const lut = getFilmLut();
  it("tem 33³ entradas, todas entre 0 e 1, e é determinística", () => {
    expect(lut.length).toBe(33 ** 3 * 3);
    expect(Array.from(lut).every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(Array.from(buildFilmLut())).toEqual(Array.from(lut));
  });
  it("cantos de preto e branco ficam perto da identidade (dentro da tolerância)", () => {
    for (const v of at(lut, 0, 0, 0)) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(TOL); }
    for (const v of at(lut, N - 1, N - 1, N - 1)) expect(Math.abs(1 - v)).toBeLessThan(TOL);
  });
  it("pretos levantados puxam para verde-azulado", () => {
    const [r, g, b] = at(lut, 0, 0, 0);
    expect(b).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
  });
  it("luminância é monotônica ao longo do eixo neutro", () => {
    let prev = -1;
    for (let i = 0; i < N; i++) { const [r, g, b] = at(lut, i, i, i); const y = lumaOf(r, g, b); expect(y).toBeGreaterThan(prev); prev = y; }
  });
  it("tem curva em S: sombras mais escuras e realces mais claros que a diagonal nos quartos", () => {
    const y = (v: number) => { const [r, g, b] = filmColor(v, v, v); return lumaOf(r, g, b); };
    expect(y(0.25) - 0.25).toBeLessThan(y(0.1) - 0.1 + 0.2); // sanidade
    const lo = y(0.25) - 0.25, hi = y(0.75) - 0.75;
    expect(lo).toBeLessThan(0.03);
    expect(hi).toBeGreaterThan(lo);
  });
  it("realces mais quentes que sombras (R−B)", () => {
    const warm = (v: number) => { const [r, , b] = filmColor(v, v, v); return r - b; };
    expect(warm(0.85)).toBeGreaterThan(warm(0.15) + 0.08);
    expect(warm(0.85)).toBeGreaterThan(0.05);
  });
  it("verdes perdem saturação e peles ficam quentes", () => {
    const sat = (c: number[]) => Math.max(...c) - Math.min(...c);
    expect(sat(filmColor(0.3, 0.7, 0.25))).toBeLessThan(sat([0.3, 0.7, 0.25]) * 0.85);
    const [r, g, b] = filmColor(0.85, 0.65, 0.55);
    expect(r).toBeGreaterThan(g); expect(g).toBeGreaterThan(b);
    expect(r - b).toBeGreaterThan(0.85 - 0.55);
  });
  it("trilinear: ponto no nó devolve o nó; no meio de um cubo devolve a média dos 8 cantos", () => {
    const node = sampleLut(lut, 5 / 32, 9 / 32, 20 / 32);
    expect(node[0]).toBeCloseTo(at(lut, 5, 9, 20)[0], 6);
    const mid = sampleLut(lut, 10.5 / 32, 4.5 / 32, 7.5 / 32);
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (const db of [0, 1]) for (const dg of [0, 1]) for (const dr of [0, 1]) s += at(lut, 10 + dr, 4 + dg, 7 + db)[c];
      expect(mid[c]).toBeCloseTo(s / 8, 6);
    }
  });
  it("trilinear: uma LUT linear (identidade) é reproduzida exatamente em qualquer ponto", () => {
    const id = new Float32Array(N ** 3 * 3);
    let o = 0;
    for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) { id[o++] = r / 32; id[o++] = g / 32; id[o++] = b / 32; }
    const out = sampleLut(id, 0.123, 0.456, 0.789);
    expect(out[0]).toBeCloseTo(0.123, 5); expect(out[1]).toBeCloseTo(0.456, 5); expect(out[2]).toBeCloseTo(0.789, 5);
  });
  it("applyLutPixels mantém o alfa e aplica a LUT", () => {
    const px = new Uint8ClampedArray([128, 128, 128, 77]);
    applyLutPixels(px);
    expect(px[3]).toBe(77);
    const [r, g, b] = filmColor(128 / 255, 128 / 255, 128 / 255);
    expect(Math.abs(px[0] - r * 255)).toBeLessThan(3); expect(Math.abs(px[1] - g * 255)).toBeLessThan(3); expect(Math.abs(px[2] - b * 255)).toBeLessThan(3);
  });
  it("tira 2D para o WebGL tem 1089×33 e bate com a tabela", () => {
    const strip = lutToStrip(lut);
    expect(strip.length).toBe(1089 * 33 * 4);
    const [r, g, b] = at(lut, 7, 12, 30);
    const d = (12 * 1089 + 30 * 33 + 7) * 4;
    expect(Math.abs(strip[d] - r * 255)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(strip[d + 1] - g * 255)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(strip[d + 2] - b * 255)).toBeLessThanOrEqual(0.5);
  });
});

describe(".cube", () => {
  const check = (txt: string) => {
    const lines = txt.trim().split("\n");
    const data = lines.filter((l) => /^[\d.]+ [\d.]+ [\d.]+$/.test(l));
    expect(data.length).toBe(35937);
    expect(lines.some((l) => l === "LUT_3D_SIZE 33")).toBe(true);
    expect(lines.some((l) => l.startsWith("DOMAIN_MIN"))).toBe(true);
    expect(lines.some((l) => l.startsWith("DOMAIN_MAX"))).toBe(true);
    expect(lines[0]).toMatch(/^TITLE "/);
    return data;
  };
  it("gerado em memória: cabeçalho válido e 35937 entradas, R variando mais rápido", () => {
    const data = check(lutToCube(getFilmLut()));
    expect(data[1].split(" ").map(Number)[0]).toBeCloseTo(at(getFilmLut(), 1, 0, 0)[0], 5);
  });
  it("o arquivo public/revela/lut/filme35.cube está em dia com o código (rode npm run gen:lut)", () => {
    const file = readFileSync(resolve(__dirname, "../../../public/revela/lut/filme35.cube"), "utf8");
    check(file);
    expect(file).toBe(lutToCube(getFilmLut()));
  });
});
