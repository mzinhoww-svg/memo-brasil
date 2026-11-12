import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filmOptions, GRAIN_SEEDS, renderPhoto, stampText } from "./capture";

/** Canvas mínimo em memória: o jsdom não desenha, então guardamos os pixels RGBA e os `fillText` para medir o resultado de `renderPhoto` (que usa `renderFilm`). */
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
/** Foto sintética: tom médio neutro com uma faixa clara e outra escura. */
function scene(): Source {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = x < W / 3 ? 70 : x > (2 * W) / 3 ? 190 : 128;
    data.set([v, v, v, 255], (y * W + x) * 4);
  }
  return { width: W, height: H, data };
}
type Style = Parameters<typeof renderPhoto>[3];
async function shoot(style: Style, takenAt = new Date(2027, 2, 14, 21, 0)) {
  const out: { texts: string[]; bytes?: Uint8ClampedArray } = { texts: [] };
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => (tag === "canvas" ? fakeCanvas(out) : Document.prototype.createElement.call(document, tag))) as typeof document.createElement);
  await renderPhoto(scene() as unknown as CanvasImageSource, W, H, style, false, takenAt);
  vi.restoreAllMocks();
  return { px: out.bytes as Uint8ClampedArray, texts: out.texts };
}
const mean = (px: Uint8ClampedArray, ch: number, x0 = 0, x1 = W) => { let s = 0, n = 0; for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) { s += px[(y * W + x) * 4 + ch]; n++; } return s / n; };
const absDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => { let s = 0; for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) s += Math.abs(a[i + k] - b[i + k]); return s / (a.length / 4 * 3); };

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("renderPhoto → renderFilm", () => {
  it("mapeia o estilo para o look: filme35/vintage → filme35 com carimbo; pb → pb sem carimbo; natural/original → natural sem carimbo; grão = ladrilho fixo deslocado pelo ms do disparo", () => {
    const t = new Date(2027, 2, 14, 21, 0);
    expect(filmOptions("filme35", t)).toMatchObject({ look: "filme35", grainOffset: t.getTime(), stamp: "'27 03 14" });
    expect(GRAIN_SEEDS).toContain(filmOptions("filme35", t).seed);
    expect(filmOptions("vintage", t)).toMatchObject({ look: "filme35", stamp: "'27 03 14" });
    expect(filmOptions("preto-e-branco", t).look).toBe("pb");
    expect(filmOptions("preto-e-branco", t).stamp).toBeUndefined();
    for (const s of ["natural", "original"] as const) { expect(filmOptions(s, t).look).toBe("natural"); expect(filmOptions(s, t).stamp).toBeUndefined(); }
    expect(filmOptions("filme35", t, true).mirror).toBe(true);
  });
  it("natural devolve a foto sem efeito e sem carimbo", async () => {
    const { px, texts } = await shoot("natural");
    expect(Array.from(px)).toEqual(Array.from(scene().data));
    expect(texts).toEqual([]);
  });
  it("diferença mensurável entre natural e filme35; realces esquentam", async () => {
    const nat = await shoot("natural"), film = await shoot("filme35");
    expect(absDiff(nat.px, film.px)).toBeGreaterThan(6);
    expect(mean(film.px, 0, 66, 92) - mean(film.px, 2, 66, 92)).toBeGreaterThan(8);
  });
  it("vintage usa o mesmo filme35 (mesmos pixels)", async () => {
    const a = await shoot("filme35"), b = await shoot("vintage");
    expect(Array.from(b.px)).toEqual(Array.from(a.px));
  });
  it("preto e branco é bem menos colorido que filme35 e não tem carimbo", async () => {
    const pb = await shoot("preto-e-branco"), film = await shoot("filme35");
    const tint = (px: Uint8ClampedArray) => Math.abs(mean(px, 0, 66, 92) - mean(px, 2, 66, 92));
    expect(tint(pb.px)).toBeLessThan(tint(film.px) / 2);
    expect(pb.texts).toEqual([]);
  });
  it("carimbo só com filme: filme35 e vintage gravam 'AA MM DD; natural e pb não", async () => {
    expect((await shoot("filme35")).texts).toEqual(["'27 03 14", "'27 03 14"]);
    expect((await shoot("vintage")).texts).toEqual(["'27 03 14", "'27 03 14"]);
    expect((await shoot("natural")).texts).toEqual([]);
    expect((await shoot("preto-e-branco")).texts).toEqual([]);
    expect(stampText(new Date(2027, 2, 14))).toBe("'27 03 14");
  });
  it("o grão é determinístico para o mesmo disparo e muda com o horário (seed)", async () => {
    const a = await shoot("filme35", new Date(2027, 2, 14, 21, 0, 0, 0)), b = await shoot("filme35", new Date(2027, 2, 14, 21, 0, 0, 0)), c = await shoot("filme35", new Date(2027, 2, 14, 21, 0, 0, 7));
    expect(Array.from(a.px)).toEqual(Array.from(b.px));
    expect(Array.from(a.px)).not.toEqual(Array.from(c.px));
  });
});
