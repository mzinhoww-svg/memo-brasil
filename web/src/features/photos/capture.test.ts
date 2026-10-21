import { describe, expect, it } from "vitest";
import { applyStylePixels } from "./capture";

const px = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);

describe("estilos da câmera", () => {
  it("original não altera os pixels", () => {
    const p = px(200, 100, 50);
    applyStylePixels(p, "original");
    expect(Array.from(p)).toEqual([200, 100, 50, 255]);
  });
  it("preto e branco iguala os canais e preserva o alfa", () => {
    const p = px(200, 100, 50);
    applyStylePixels(p, "preto-e-branco");
    expect(p[0]).toBe(p[1]);
    expect(p[1]).toBe(p[2]);
    expect(p[3]).toBe(255);
  });
  it("vintage esquenta: vermelho acima do azul numa cor neutra", () => {
    const p = px(128, 128, 128);
    applyStylePixels(p, "vintage");
    expect(p[0]).toBeGreaterThan(p[2]);
  });
  it("não estoura 0–255 em extremos", () => {
    const p = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    applyStylePixels(p, "vintage");
    expect(Math.max(...p)).toBeLessThanOrEqual(255);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(0);
  });
});
