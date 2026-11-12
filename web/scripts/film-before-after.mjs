#!/usr/bin/env node
/**
 * Prova do Filme 35mm: pega fotos "naturais" e salva antes/depois com o `renderFilm` REAL (film/film-canvas.ts) rodando no Chromium headless.
 * Saída: docs/evidence/filme35/antes-depois-<nome>.jpg (antes à esquerda, depois à direita) e <nome>-depois.jpg.
 * Uso: node scripts/film-before-after.mjs   (CHROMIUM=/caminho opcional; padrão /opt/pw-browsers/chromium)
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "../docs/evidence/filme35");
mkdirSync(out, { recursive: true });

// Empacota os 3 módulos do designer (sem alterá-los) num único script: TS → JS, sem imports/exports.
const dir = resolve(root, "src/features/photos/film");
const bundle = ["film35-lut.ts", "film35.ts", "film-canvas.ts"].map((f) => {
  const js = ts.transpileModule(readFileSync(resolve(dir, f), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  return js.replace(/^import .*;$/gm, "").replace(/^export \{[^}]*\};?$/gm, "").replace(/^export (const|function|type|class)/gm, "$1");
}).join("\n") + "\nwindow.__film = { renderFilm, stampText };";

const fotos = [["bolo", "sc-bolo-natural.jpg"], ["brinde", "sc-brinde-natural.jpg"]];
const takenAt = new Date(2027, 2, 14, 21, 32).getTime();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
await page.addScriptTag({ content: bundle });
for (const [nome, arquivo] of fotos) {
  const b64 = readFileSync(resolve(root, "public/revela/ref", arquivo)).toString("base64");
  const r = await page.evaluate(async ({ b64, takenAt }) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();
    const side = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * side), h = Math.round(img.naturalHeight * side);
    const mk = (opts) => { const c = document.createElement("canvas"); c.width = w; c.height = h; window.__film.renderFilm(c, img, img.naturalWidth, img.naturalHeight, opts); return c; };
    const antes = mk({ look: "natural" });
    const depois = mk({ look: "filme35", seed: takenAt, stamp: window.__film.stampText(new Date(takenAt)) });
    const par = document.createElement("canvas"); par.width = w * 2; par.height = h;
    const g = par.getContext("2d"); g.drawImage(antes, 0, 0); g.drawImage(depois, w, 0);
    return { par: par.toDataURL("image/jpeg", 0.9), depois: depois.toDataURL("image/jpeg", 0.85), w, h };
  }, { b64, takenAt });
  writeFileSync(resolve(out, `antes-depois-${nome}.jpg`), Buffer.from(r.par.split(",")[1], "base64"));
  writeFileSync(resolve(out, `${nome}-depois.jpg`), Buffer.from(r.depois.split(",")[1], "base64"));
  console.log(`${nome}: ${r.w}x${r.h} -> docs/evidence/filme35/antes-depois-${nome}.jpg`);
}
await browser.close();
