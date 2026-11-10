import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderPhoto, stampText } from "./capture";

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
  it("filme35 esquenta o matiz: vermelho acima do azul numa cena neutra", async () => {
    const nat = await shoot("natural"), film = await shoot("filme35");
    const warmNat = mean(nat.px, 0) - mean(nat.px, 2), warmFilm = mean(film.px, 0) - mean(film.px, 2);
    expect(warmNat).toBe(0);
    expect(warmFilm).toBeGreaterThan(15);
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
  it("filme35 tem vinheta e brilho de flash: centro mais claro que os cantos", async () => {
    const film = await shoot("filme35");
    const at = (x: number, y: number) => luma(film.px, (y * W + x) * 4);
    const centre = (at(46, 30) + at(48, 32) + at(50, 34)) / 3; // faixa lisa (128) no meio
    const nat = 128;
    expect(centre).toBeGreaterThan(nat + 2);
    const corner = mean(film.px, 0, 0, 6);
    const natCorner = 70;
    expect(corner).toBeLessThan(natCorner + 18 /* tom quente */ - 3);
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
