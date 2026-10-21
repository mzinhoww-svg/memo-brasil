import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_RULES, sniffImage, validateSniffed, type Sniffed } from "../../../supabase/functions/_shared/image-sniff";

const b64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const PNG = new Uint8Array(readFileSync(path.resolve(__dirname, "../../public/pwa/icon-192.png")));
const JPEG_1x1 = b64("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=");
const WEBP_LOSSY_1x1 = b64("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");
const WEBP_LOSSLESS_1x1 = b64("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");
const text = (s: string) => new TextEncoder().encode(s);

function webpVp8x(w: number, h: number): Uint8Array {
  const u = new Uint8Array(30);
  u.set(text("RIFF"), 0); new DataView(u.buffer).setUint32(4, 22, true); u.set(text("WEBP"), 8); u.set(text("VP8X"), 12);
  new DataView(u.buffer).setUint32(16, 10, true);
  u[24] = (w - 1) & 255; u[25] = ((w - 1) >> 8) & 255; u[26] = ((w - 1) >> 16) & 255;
  u[27] = (h - 1) & 255; u[28] = ((h - 1) >> 8) & 255; u[29] = ((h - 1) >> 16) & 255;
  return u;
}
function pngWith(w: number, h: number): Uint8Array {
  const u = PNG.slice(0, 33); const dv = new DataView(u.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return u;
}

describe("sniffImage: assinatura e dimensões reais", () => {
  it("PNG: lê o IHDR (192x192)", () => expect(sniffImage(PNG)).toEqual({ mime: "image/png", width: 192, height: 192 }));
  it("JPEG: lê o SOF (1x1)", () => expect(sniffImage(JPEG_1x1)).toEqual({ mime: "image/jpeg", width: 1, height: 1 }));
  it("WebP lossy, lossless e estendido (VP8X)", () => {
    expect(sniffImage(WEBP_LOSSY_1x1)).toEqual({ mime: "image/webp", width: 1, height: 1 });
    expect(sniffImage(WEBP_LOSSLESS_1x1)).toEqual({ mime: "image/webp", width: 1, height: 1 });
    expect(sniffImage(webpVp8x(1600, 900))).toEqual({ mime: "image/webp", width: 1600, height: 900 });
  });
  it("recusa HTML, SVG, GIF, texto e vazio, mesmo que o nome/Content-Type digam imagem", () => {
    for (const body of [text("<html><script>alert(1)</script></html>"), text("<svg xmlns='http://www.w3.org/2000/svg'/>"), text("GIF89a\x01\x00\x01\x00"), text("não sou imagem"), new Uint8Array(0)]) expect(sniffImage(body)).toBeNull();
  });
  it("recusa arquivo truncado e assinatura sem cabeçalho de imagem", () => {
    expect(sniffImage(PNG.slice(0, 12))).toBeNull();
    expect(sniffImage(JPEG_1x1.slice(0, 6))).toBeNull();
    expect(sniffImage(text("RIFF\0\0\0\0WEBPxxxx"))).toBeNull();
  });
  it("polyglot: PNG com HTML anexado continua PNG (o conteúdo servido é só imagem, com nosniff)", () => {
    const poly = new Uint8Array([...PNG, ...text("<script>alert(1)</script>")]);
    expect(sniffImage(poly)?.mime).toBe("image/png");
  });
});

describe("validateSniffed: regras do ativo", () => {
  const ok: Sniffed = { mime: "image/png", width: 400, height: 400 };
  it("aceita dentro dos limites e confere o tipo declarado", () => {
    expect(validateSniffed("logo", 1000, ok, "image/png")).toEqual({ ok: true, width: 400, height: 400, mime: "image/png" });
  });
  it("recusa tipo real diferente do declarado (Content-Type mentiroso)", () => {
    expect(validateSniffed("logo", 1000, { ...ok, mime: "image/jpeg" }, "image/png")).toMatchObject({ ok: false, reason: "tipo" });
  });
  it("recusa conteúdo que não é imagem", () => expect(validateSniffed("cover", 1000, null, "image/png")).toMatchObject({ ok: false, reason: "assinatura" }));
  it("limites de bytes: logo 2 MiB e capa 5 MiB", () => {
    expect(validateSniffed("logo", ASSET_RULES.logo.maxBytes + 1, ok, "image/png")).toMatchObject({ ok: false, reason: "tamanho" });
    expect(validateSniffed("cover", ASSET_RULES.cover.maxBytes, ok, "image/png")).toMatchObject({ ok: true });
  });
  it("dimensões reais fora de 16–8192 ou acima do teto de pixels (bomba de descompressão)", () => {
    expect(validateSniffed("logo", 100, { ...ok, width: 8 }, "image/png")).toMatchObject({ ok: false, reason: "dimensoes" });
    expect(validateSniffed("cover", 100, { ...ok, width: 8193 }, "image/png")).toMatchObject({ ok: false, reason: "dimensoes" });
    expect(validateSniffed("cover", 100, { ...ok, width: 8000, height: 8000 }, "image/png")).toMatchObject({ ok: false, reason: "pixels" });
    expect(sniffImage(pngWith(8000, 8000))).toMatchObject({ width: 8000, height: 8000 });
  });
});
