import { describe, expect, it } from "vitest";
import { ASSET_LIMITS, validateAssetFile } from "./assets";

const f = (type: string, size: number) => ({ type, size });
describe("validateAssetFile", () => {
  it("aceita png/jpeg/webp dentro do limite de tamanho e dimensões", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp"]) expect(validateAssetFile("logo", f(t, 1000), { width: 400, height: 400 })).toEqual({ ok: true });
  });
  it("recusa SVG, GIF e qualquer tipo fora da lista (vetor de XSS)", () => {
    for (const t of ["image/svg+xml", "image/gif", "text/html", "application/pdf", ""]) expect(validateAssetFile("cover", f(t, 1000), { width: 800, height: 600 })).toMatchObject({ ok: false, reason: "tipo" });
  });
  it("logo até 2 MiB e capa até 5 MiB", () => {
    expect(validateAssetFile("logo", f("image/png", ASSET_LIMITS.logo.bytes + 1), { width: 100, height: 100 })).toMatchObject({ ok: false, reason: "tamanho" });
    expect(validateAssetFile("logo", f("image/png", ASSET_LIMITS.logo.bytes), { width: 100, height: 100 })).toEqual({ ok: true });
    expect(validateAssetFile("cover", f("image/jpeg", ASSET_LIMITS.cover.bytes + 1), { width: 100, height: 100 })).toMatchObject({ ok: false, reason: "tamanho" });
    expect(validateAssetFile("cover", f("image/jpeg", 3 * 1024 * 1024), { width: 1600, height: 900 })).toEqual({ ok: true });
  });
  it("recusa arquivo vazio e dimensões fora de 16–8192 px", () => {
    expect(validateAssetFile("logo", f("image/png", 0), { width: 100, height: 100 })).toMatchObject({ ok: false, reason: "tamanho" });
    expect(validateAssetFile("logo", f("image/png", 10), { width: 8, height: 100 })).toMatchObject({ ok: false, reason: "dimensoes" });
    expect(validateAssetFile("cover", f("image/png", 10), { width: 9000, height: 100 })).toMatchObject({ ok: false, reason: "dimensoes" });
  });
});
