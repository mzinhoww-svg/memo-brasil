// @vitest-environment node
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { inviteUrl } from "./links";
import { QR_PNG_SIZE, QR_QUIET, fileSlug, qrFileName, qrMatrix, qrRaster, qrSvg } from "./qr-export";

const URL_GERAL = inviteUrl("https://fotosdocasamento.online", "ABCD2345");
const URL_MESA = inviteUrl("https://fotosdocasamento.online", "ABCD2345", "Mesa 03");

/** Codifica em PNG de verdade e lê de volta, como faria o arquivo baixado. */
function roundTripPng(text: string, transparent: boolean) {
  const r = qrRaster(text, { transparent });
  const png = new PNG({ width: r.width, height: r.height });
  png.data = Buffer.from(r.data);
  const back = PNG.sync.read(PNG.sync.write(png));
  return { back, decoded: jsQR(new Uint8ClampedArray(back.data), back.width, back.height) };
}

/** Rasteriza o SVG com o mesmo recorte de módulos (1 módulo = 8 px) para decodificá-lo sem navegador. */
function decodeSvg(svg: string) {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!;
  const total = Number(vb[1]);
  const scale = 8;
  const w = total * scale;
  const px = new Uint8ClampedArray(w * w * 4).fill(255);
  const d = /<path[^>]* d="([^"]+)"/.exec(svg)![1];
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, len] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let yy = y * scale; yy < (y + 1) * scale; yy++) for (let xx = x * scale; xx < (x + len) * scale; xx++) { const i = (yy * w + xx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  }
  return jsQR(px, w, w);
}

describe("QR para download", () => {
  it("SVG vetorial: decodifica de volta a URL, sem texto, imagem nem logotipo", () => {
    const svg = qrSvg(URL_GERAL);
    expect(decodeSvg(svg)?.data).toBe(URL_GERAL);
    expect(svg).toMatch(/^<\?xml/);
    expect(svg).not.toMatch(/<(text|image|rect|circle)/);
    const n = qrMatrix(URL_GERAL).length;
    expect(svg).toContain(`viewBox="0 0 ${n + 2 * QR_QUIET} ${n + 2 * QR_QUIET}"`);
  });
  it("PNG 2048 px com fundo branco: decodifica a URL e tem margem de silêncio de 4 módulos", () => {
    const { back, decoded } = roundTripPng(URL_MESA, false);
    expect([back.width, back.height]).toEqual([QR_PNG_SIZE, QR_PNG_SIZE]);
    expect(decoded?.data).toBe(URL_MESA);
    expect([back.data[3], back.data[0]]).toEqual([255, 255]);
    // o primeiro pixel escuro só aparece depois de 4 módulos
    const total = qrMatrix(URL_MESA).length + 2 * QR_QUIET;
    const quiet = Math.floor((QR_QUIET * QR_PNG_SIZE) / total);
    let firstDark = -1;
    for (let x = 0; x < back.width && firstDark < 0; x++) for (let y = 0; y < back.height; y++) if (back.data[(y * back.width + x) * 4] === 0) { firstDark = x; break; }
    expect(firstDark).toBeGreaterThanOrEqual(quiet - 1);
  });
  it("PNG transparente: canais alfa zerados no fundo, módulos pretos opacos e leitura ok sobre branco", () => {
    const { back } = roundTripPng(URL_GERAL, true);
    expect(back.data[3]).toBe(0);
    const flat = new Uint8ClampedArray(back.data.length);
    for (let i = 0; i < flat.length; i += 4) { const a = back.data[i + 3]; flat[i] = flat[i + 1] = flat[i + 2] = back.data[i] * (a / 255) + 255 * (1 - a / 255); flat[i + 3] = 255; }
    expect(jsQR(flat, back.width, back.height)?.data).toBe(URL_GERAL);
    expect(back.data.some((v, i) => i % 4 === 3 && v === 255)).toBe(true);
  });
  it("nomes de arquivo seguros, por evento e por mesa", () => {
    expect(qrFileName("Ana & Rui", "svg")).toBe("qr-ana-e-rui.svg");
    expect(qrFileName("Ana & Rui", "svg", "Mesa 03")).toBe("qr-ana-e-rui-mesa-03.svg");
    expect(qrFileName("Ana & Rui", "png-transparente")).toBe("qr-ana-e-rui-transparente.png");
    expect(fileSlug("../../")).toBe("evento");
    expect(fileSlug("Celebração dos 50 anos de casamento de Maria Aparecida Conceição").length).toBeLessThanOrEqual(40);
  });
});
