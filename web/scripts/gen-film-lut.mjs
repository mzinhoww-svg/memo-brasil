#!/usr/bin/env node
/**
 * Gera a LUT 3D do "Filme 35mm" como arquivo `.cube` (33x33x33 = 35937 entradas) e uma imagem de amostra.
 *   npm run gen:lut
 * A LUT vem do MESMO código usado no app (src/features/photos/film-lut.ts): os parâmetros e a explicação de
 * cada um estão em FILM_LUT_PARAMS e em docs/qa/FILTRO-35MM.md. Node >= 22.6 (importa o .ts direto).
 *
 * Saídas:
 *   public/revela/lut/filme35.cube            — para Resolve, Photoshop, Lightroom, ffmpeg (lut3d) etc.
 *   public/revela/lut/amostra-bolo-lut.jpg    — sc-bolo-natural.jpg só com a LUT (conferência visual da cor)
 *   public/revela/lut/amostra-bolo-filme35.jpg — o pipeline completo (LUT + halation + vinheta + grão, sem carimbo)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { applyFilmLook } = await import(resolve(root, "src/features/photos/film-fx.ts"));
const { buildFilmLut, lutToCube, applyLutPixels, FILM_LUT_PARAMS } = await import(resolve(root, "src/features/photos/film-lut.ts"));

const lut = buildFilmLut();
await mkdir(resolve(root, "public/revela/lut"), { recursive: true });
await writeFile(resolve(root, "public/revela/lut/filme35.cube"), lutToCube(lut));
console.log("filme35.cube:", lut.length / 3, "entradas; parâmetros:", JSON.stringify(FILM_LUT_PARAMS));

const { data, info } = await sharp(resolve(root, "public/revela/ref/sc-bolo-natural.jpg")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const save = (px, name) => sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width: info.width, height: info.height, channels: 4 } }).jpeg({ quality: 88 }).toFile(resolve(root, "public/revela/lut", name));
const lutOnly = new Uint8ClampedArray(data);
applyLutPixels(lutOnly, lut);
await save(lutOnly, "amostra-bolo-lut.jpg");
const full = new Uint8ClampedArray(data);
applyFilmLook(full, info.width, info.height, 20270314);
await save(full, "amostra-bolo-filme35.jpg");
console.log("amostras geradas");
