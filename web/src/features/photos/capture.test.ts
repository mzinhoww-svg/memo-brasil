import { describe, expect, it } from "vitest";
import { applyStylePixels, cameraHelp, isEmbeddedBrowser } from "./capture";

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

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.0",
  facebook: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]",
  fban: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]",
  whatsapp: "WhatsApp/2.24.10 i",
};

describe("navegador embutido e ajuda da câmera negada", () => {
  it("reconhece Instagram, Facebook e WhatsApp, e não confunde Safari/Chrome", () => {
    for (const ua of [UA.instagram, UA.facebook, UA.fban, UA.whatsapp]) expect(isEmbeddedBrowser(ua)).toBe(true);
    for (const ua of [UA.iphoneSafari, UA.androidChrome]) expect(isEmbeddedBrowser(ua)).toBe(false);
  });
  it("passos do Safari no iPhone e do Chrome no Android", () => {
    const ios = cameraHelp(UA.iphoneSafari);
    expect(ios.browser).toBe("Safari no iPhone");
    expect(ios.steps).toEqual(["Toque em aA ao lado do endereço.", "Ajustes do site › Câmera › Permitir.", "Volte aqui e toque abaixo."]);
    const android = cameraHelp(UA.androidChrome);
    expect(android.browser).toBe("Chrome no Android");
    expect(android.steps[0]).toMatch(/cadeado/);
    expect(android.steps).toHaveLength(3);
  });
});
