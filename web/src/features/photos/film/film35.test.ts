import { describe, expect, it } from "vitest";
import { applyFilm, gradeColor, grainTile } from "./film35";

const lum = ([r, g, b]: number[]) => r * 0.2126 + g * 0.7152 + b * 0.0722;

describe("Filme 35mm · cor", () => {
  it("levanta o preto e segura o branco (papel, não tela)", () => {
    expect(gradeColor([0, 0, 0])).toEqual([10, 11, 13]);
    expect(gradeColor([255, 255, 255])).toEqual([253, 249, 236]);
  });
  it("esquenta os neutros: vermelho acima do azul no cinza médio e no branco", () => {
    const [r, , b] = gradeColor([119, 119, 119]);
    expect(r).toBeGreaterThan(b);
    expect(gradeColor([119, 119, 119])).toEqual([133, 127, 118]);
  });
  it("mantém a rampa de cinza sempre crescente (sem posterizar)", () => {
    let prev = -1;
    for (let v = 0; v <= 255; v += 5) { const y = lum(gradeColor([v, v, v])); expect(y).toBeGreaterThanOrEqual(prev); prev = y; }
  });
  it("protege os tons de pele: continuam quentes e na mesma ordem de claridade", () => {
    const skins: [number, number, number][] = [[241, 194, 160], [198, 134, 94], [90, 56, 37]];
    const out = skins.map((s) => gradeColor(s));
    expect(out).toEqual([[248, 206, 158], [215, 142, 84], [97, 57, 35]]);
    for (const [r, g, b] of out) { expect(r).toBeGreaterThan(g); expect(g).toBeGreaterThan(b); }
    expect(lum(out[0])).toBeGreaterThan(lum(out[1]));
    expect(lum(out[1])).toBeGreaterThan(lum(out[2]));
  });
  it("leva o verde para o oliva e o azul para o ciano", () => {
    expect(gradeColor([70, 148, 73])).toEqual([108, 147, 67]);
    expect(gradeColor([56, 61, 150])).toEqual([42, 69, 137]);
  });
  it("preto e branco sai quase neutro, com papel morno", () => {
    const [r, g, b] = gradeColor([175, 54, 60], "pb");
    expect([r, g, b]).toEqual([117, 116, 113]);
    expect(r - b).toBeLessThanOrEqual(6);
  });
});

describe("Filme 35mm · pipeline", () => {
  const make = (w: number, h: number) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; px[i] = (x * 255) / (w - 1); px[i + 1] = (y * 255) / (h - 1); px[i + 2] = ((x + y) * 255) / (w + h - 2); px[i + 3] = 255; }
    return px;
  };
  const adler = (px: Uint8ClampedArray) => { let a = 1, b = 0; for (let i = 0; i < px.length; i++) { a = (a + px[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; };

  it("dá sempre o mesmo resultado para a mesma semente (valor de referência)", () => {
    const px = make(48, 32);
    applyFilm(px, 48, 32, { seed: 42 });
    expect(adler(px)).toBe(595495195);
  });
  it("muda o grão quando a semente muda, e não toca no alfa", () => {
    const a = make(48, 32), b = make(48, 32);
    applyFilm(a, 48, 32, { seed: 1 }); applyFilm(b, 48, 32, { seed: 2 });
    expect(adler(a)).not.toBe(adler(b));
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });
  it("escurece os cantos com a vinheta", () => {
    const px = new Uint8ClampedArray(64 * 64 * 4).fill(200);
    applyFilm(px, 64, 64, { grain: 0, halation: 0 });
    expect(px[0]).toBeLessThan(px[(32 * 64 + 32) * 4]);
  });
  it("põe halo vermelho ao redor de uma luz forte", () => {
    const w = 400, h = 400, px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 12; px[i * 4 + 3] = 255; }
    for (let y = 180; y < 220; y++) for (let x = 180; x < 220; x++) { const i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = 255; }
    applyFilm(px, w, h, { grain: 0, vignette: 0 });
    const near = (200 * w + 226) * 4, far = (200 * w + 380) * 4;
    expect(px[near] - px[near + 2]).toBeGreaterThan(px[far] - px[far + 2] + 8);
  });
  it("gera ladrilho de grão com média ~0 e desvio 1", () => {
    const t = grainTile(9); let m = 0, s = 0;
    for (const v of t) { m += v; s += v * v; }
    expect(Math.abs(m / t.length)).toBeLessThan(0.02);
    expect(Math.sqrt(s / t.length)).toBeCloseTo(1, 3);
  });
});
