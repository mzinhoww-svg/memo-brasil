// Prova de fidelidade: abre /dev/revela/<tela> (dados do desenho) em 390x844 (Master 1440x900), compara com o WebP da referência
// e grava docs/evidence/revela-fiel/<id>.png (referência | implementação | diferença) + linha em CHECKLIST.md.
// Uso: BASE=http://localhost:3190 node scripts/revela-evidence.mjs [id ...]   (sem ids = todas)
import { chromium } from "playwright";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.env.BASE ?? "http://localhost:3190";
const reg = readFileSync(join(root, "web/src/revela/registry.ts"), "utf8");
const SCREENS = JSON.parse(reg.slice(reg.indexOf("= [") + 2, reg.lastIndexOf("];") + 1));
const ids = process.argv.slice(2);
const list = SCREENS.filter((s) => !ids.length || ids.includes(s.id));
const OUT = join(root, "docs/evidence/revela-fiel");
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const results = [];
for (const s of list) {
  const [w, h] = s.master ? [1440, 900] : [390, 844];
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/dev/revela/${s.html}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const impl = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
    const ref = await sharp(join(root, "design-system/revela", s.webp)).resize(w, h, { fit: "fill" }).png().toBuffer();
    const A = PNG.sync.read(ref), B = PNG.sync.read(impl), D = new PNG({ width: w, height: h });
    const n = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.2, includeAA: false });
    const pct = (100 * n) / (w * h);
    const gap = 10;
    const sheet = new PNG({ width: w * 3 + gap * 2, height: h });
    sheet.data.fill(60);
    for (const [img, i] of [[A, 0], [B, 1], [D, 2]]) PNG.bitblt(img, sheet, 0, 0, w, h, i * (w + gap), 0);
    writeFileSync(join(OUT, `${s.id}.png`), await sharp(PNG.sync.write(sheet)).png({ palette: true, quality: 70, effort: 7 }).toBuffer());
    results.push({ ...s, pct });
    console.log(`${s.id.padEnd(4)} ${pct.toFixed(2).padStart(6)}%  ${s.title}`);
  } catch (e) {
    results.push({ ...s, pct: NaN, error: String(e).slice(0, 80) });
    console.log(`${s.id.padEnd(4)}  ERRO  ${s.title}: ${String(e).slice(0, 80)}`);
  }
  await ctx.close();
}
await b.close();
// tabela
const cl = join(root, "docs/evidence/revela-fiel/CHECKLIST.md");
const prev = existsSync(cl) ? readFileSync(cl, "utf8") : "";
const rows = new Map();
for (const l of prev.split("\n")) { const m = l.match(/^\| (\S+) \|/); if (m && m[1] !== "Tela") rows.set(m[1], l); }
for (const r of results) {
  const old = rows.get(r.id)?.split("|").map((c) => c.trim()) ?? [];
  rows.set(r.id, `| ${r.id} | ${r.title} | ${r.html} | ${Number.isNaN(r.pct) ? "erro" : r.pct.toFixed(2) + "%"} | ![](${r.id}.png) | ${old[6] ?? "referência portada (dados do desenho)"} | ${old[7] ?? "não ligada ao app"} |`);
}
const order = SCREENS.map((s) => s.id);
const body = [...rows.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map((e) => e[1]).join("\n");
writeFileSync(cl, `# Revela 2.0: fidelidade tela a tela\n\nReferência (esquerda) | implementação com os dados do desenho (centro) | diferença pixelmatch (direita). 390×844; Master 1440×900. Geradas por \`web/scripts/revela-evidence.mjs\`.\n\n| Tela | Título | HTML | Diff | Prova | Estado do markup | Ligação ao app |\n|---|---|---|---|---|---|---|\n${body}\n`);
