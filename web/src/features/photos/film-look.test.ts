import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderPhoto, stampText } from "./capture";
import { filmColor } from "./film-lut";

/** Canvas mínimo em memória: o jsdom não desenha, então o teste guarda os pixels RGBA e os `fillText` para medir o resultado de `renderPhoto`. */
type Source = { width: number; height: number; data: Uint8ClampedArray };
function fakeCanvas(out: { texts: string[]; bytes?: Uint8ClampedArray }) {
  let buf: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(0);
  const c = {
    width: 0, height: 0,
    getContext: () => ({
      translate() {}, scale() {}, save() {}, restore() {},
      set font(_v: string) {}, set textAlign(_v: string) {}, set textBaseline(_v: string) {}, set shadowColor(_v: string) {}, set shadowBlur(_v: number) {}, set fillStyle(_v: string) {},
      drawImage(src: Source) { buf = new Uint8ClampedArray(src.data) as Uint8ClampedArray<ArrayBuffer>; },
      getImageData: () => ({ data: buf, width: c.width, height: c.height }),
      putImageData(img: { data: Uint8ClampedArray }) { buf = img.data as Uint8ClampedArray<ArrayBuffer>; },
      fillText(t: string) { out.texts.push(t); },
    }),
    toBlob(cb: (b: unknown) => void) { out.bytes = buf; cb({ arrayBuffer: async () => buf.buffer }); },
  };
  return c;
}

const W = 96, H = 72;
/** Foto sintética: tom médio neutro com uma faixa clara e outra escura (dá contraste para medir). */
function scene(): Source {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = x < W / 3 ? 70 : x > (2 * W) / 3 ? 190 : 128;
    data.set([v, v, v, 255], (y * W + x) * 4);
  }
  return { width: W, height: H, data };
}
async function shoot(look: "natural" | "filme35", takenAt = new Date(2027, 2, 14, 21, 0)) {
  const out: { texts: string[]; bytes?: Uint8ClampedArray } = { texts: [] };
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => (tag === "canvas" ? fakeCanvas(out) : Document.prototype.createElement.call(document, tag))) as typeof document.createElement);
  await renderPhoto(scene() as unknown as CanvasImageSource, W, H, look, false, takenAt);
  vi.restoreAllMocks();
  return { px: out.bytes as Uint8ClampedArray, texts: out.texts };
}
const mean = (px: Uint8ClampedArray, ch: number, x0 = 0, x1 = W) => { let s = 0, n = 0; for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { s += px[(y * W + x) * 4 + ch]; n++; } return s / n; };
const luma = (px: Uint8ClampedArray, i: number) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
/** Grão: variação pixel a pixel dentro de uma faixa que na cena original é lisa. */
const roughness = (px: Uint8ClampedArray) => { let s = 0, n = 0; for (let y = 0; y < H; y++) for (let x = 36; x < 58; x++) { s += Math.abs(luma(px, (y * W + x) * 4) - luma(px, (y * W + x + 1) * 4)); n++; } return s / n; };
const spread = (px: Uint8ClampedArray) => Math.abs(mean(px, 0, 66, 92) - mean(px, 0, 4, 30));

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("o mesmo quadro em natural e em Filme 35mm (A2)", () => {
  it("natural devolve a foto sem efeito e sem carimbo", async () => {
    const { px, texts } = await shoot("natural");
    expect(Array.from(px)).toEqual(Array.from(scene().data));
    expect(texts).toEqual([]);
  });
  it("filme35 esquenta os realces: vermelho acima do azul na faixa clara; as sombras ficam verde-azuladas", async () => {
    const nat = await shoot("natural"), film = await shoot("filme35");
    expect(mean(nat.px, 0, 66, 92) - mean(nat.px, 2, 66, 92)).toBe(0);
    expect(mean(film.px, 0, 66, 92) - mean(film.px, 2, 66, 92)).toBeGreaterThan(8);
    expect(mean(film.px, 2, 4, 30)).toBeGreaterThan(mean(film.px, 0, 4, 30));
  });
  it("a foto guardada usa a LUT: a faixa lisa do meio bate com a LUT (mais grão e vinheta)", async () => {
    const film = await shoot("filme35");
    const [r, g, b] = filmColor(128 / 255, 128 / 255, 128 / 255);
    const mid = (ch: number) => mean(film.px, ch, 40, 56);
    expect(Math.abs(mid(0) - r * 255)).toBeLessThan(8);
    expect(Math.abs(mid(1) - g * 255)).toBeLessThan(8);
    expect(Math.abs(mid(2) - b * 255)).toBeLessThan(8);
  });
  it("diferença mensurável entre natural e filme35 (média absoluta por canal)", async () => {
    const nat = await shoot("natural"), film = await shoot("filme35");
    let s = 0;
    for (let i = 0; i < nat.px.length; i += 4) for (let k = 0; k < 3; k++) s += Math.abs(nat.px[i + k] - film.px[i + k]);
    expect(s / (nat.px.length / 4 * 3)).toBeGreaterThan(6);
  });
  it("filme35 muda o contraste entre as faixas escura e clara", async () => {
    const nat = await shoot("natural"), film = await shoot("filme35");
    expect(Math.abs(spread(film.px) - spread(nat.px))).toBeGreaterThan(4);
  });
  it("filme35 tem grão: a faixa lisa ganha variação pixel a pixel", async () => {
    const nat = await shoot("natural"), film = await shoot("filme35");
    expect(roughness(nat.px)).toBe(0);
    expect(roughness(film.px)).toBeGreaterThan(4);
  });
  it("filme35 tem vinheta: o canto fica mais escuro do que a LUT sozinha o deixaria", async () => {
    const film = await shoot("filme35");
    const [r] = filmColor(70 / 255, 70 / 255, 70 / 255);
    expect(mean(film.px, 0, 0, 4)).toBeLessThan(r * 255 - 3);
  });
  it("halation: o realce vaza luz avermelhada para a faixa vizinha mais escura", async () => {
    const film = await shoot("filme35");
    const lutOnly = filmColor(128 / 255, 128 / 255, 128 / 255);
    // coluna 56..64 é a faixa média encostada na clara (x > 64): ganha brilho extra, mais em R que em B
    const dR = mean(film.px, 0, 58, 64) - lutOnly[0] * 255, dB = mean(film.px, 2, 58, 64) - lutOnly[2] * 255;
    expect(dR).toBeGreaterThan(dB);
  });
  it("filme35 grava o carimbo 'AA MM DD da hora da foto; natural não", async () => {
    const film = await shoot("filme35", new Date(2027, 2, 14, 21, 0));
    expect(film.texts).toEqual(["'27 03 14"]);
    expect(stampText(new Date(2027, 2, 14))).toBe("'27 03 14");
  });
  it("o grão é o mesmo para a mesma foto (determinístico) e muda de uma foto para outra", async () => {
    const a = await shoot("filme35", new Date(2027, 2, 14, 21, 0)), b = await shoot("filme35", new Date(2027, 2, 14, 21, 0)), c = await shoot("filme35", new Date(2027, 2, 14, 21, 5));
    expect(Array.from(a.px)).toEqual(Array.from(b.px));
    expect(Array.from(a.px)).not.toEqual(Array.from(c.px));
  });
});
