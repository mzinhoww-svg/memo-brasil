// Gera os assets responsivos do Revela 2.0 a partir de design-system/revela/ (fonte da verdade).
// Saída: web/public/revela/** em WebP (e AVIF onde compensa), mais o vídeo da abertura e os logos.
// Uso: npm run gen:revela
import sharp from "sharp";
import { mkdir, copyFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = (p) => join(root, "design-system", "revela", p);
const out = (p) => join(root, "web", "public", "revela", p);

const jobs = [];
async function webp(input, output, width, opts = {}) {
  await mkdir(dirname(out(output)), { recursive: true });
  let img = sharp(src(input));
  if (width) img = img.resize({ width, withoutEnlargement: true });
  await img.webp({ quality: opts.quality ?? 80, alphaQuality: 90, effort: 5 }).toFile(out(output));
  jobs.push(output);
}
async function avif(input, output, width) {
  await mkdir(dirname(out(output)), { recursive: true });
  await sharp(src(input)).resize({ width, withoutEnlargement: true }).avif({ quality: 55, effort: 4 }).toFile(out(output));
  jobs.push(output);
}

// Câmeras 3D por embalagem (render com alfa, 3/4 frontal)
for (const w of ["festa", "casamento", "aniversario", "noite"]) {
  for (const size of [360, 640, 960]) await webp(`3d/clean/cam-${w}.png`, `3d/cam-${w}-${size}.webp`, size);
  await avif(`3d/clean/cam-${w}.png`, `3d/cam-${w}-640.avif`, 640);
  // amostras de material para o seletor de embalagem
  await webp(`embalagens/wrap-${w}.png`, `embalagens/wrap-${w}.webp`, 640, { quality: 78 });
  await webp(`embalagens/label-${w}.jpg`, `embalagens/label-${w}.webp`, 640, { quality: 78 });
}
await webp("3d/cam-hero.webp", "3d/cam-hero-640.webp", 640);
await webp("3d/cam-hero.webp", "3d/cam-hero-900.webp", 900);
for (const o of ["balloons", "cake", "confetti", "disco", "rings"]) await webp(`3d/obj-${o}.png`, `3d/obj-${o}.webp`, 480);

// Cenas de mockup: só para a festa de exemplo (/exemplo)
for (const c of ["aliancas", "baloes", "bolo", "bolo-natural", "brinde", "camera", "pista"]) {
  await webp(`cenas/sc-${c}.jpg`, `exemplo/sc-${c}-360.webp`, 360, { quality: 72 });
  await webp(`cenas/sc-${c}.jpg`, `exemplo/sc-${c}-720.webp`, 720, { quality: 74 });
}

// Efeitos de pós
await webp("efeitos/fx-grain.png", "fx/grain.webp", 512, { quality: 70 });
await webp("efeitos/fx-bloom.png", "fx/bloom.webp", 600, { quality: 70 });
await webp("efeitos/leak.png", "fx/leak.webp", 390, { quality: 60 });

// Vídeo da abertura + poster
await mkdir(out("video"), { recursive: true });
await copyFile(src("video/revela-abertura.mp4"), out("video/revela-abertura.mp4"));
await webp("video/revela-abertura-poster.jpg", "video/revela-abertura-poster.webp", 540, { quality: 72 });

// Logos (SVG) e ícones do PWA
await mkdir(out("logos"), { recursive: true });
for (const f of ["revela-app-icon.svg", "revela-lockup-dark.svg", "revela-mark-light.svg", "revela-mark.svg", "revela-wordmark-ink.svg", "revela-wordmark-paper.svg"]) {
  await copyFile(src(`logos/${f}`), out(`logos/${f}`));
}
const pwa = join(root, "web", "public", "pwa");
await mkdir(pwa, { recursive: true });
const icon = src("logos/revela-app-icon-1024.png");
for (const s of [192, 512]) await sharp(icon).resize(s, s).png({ compressionLevel: 9 }).toFile(join(pwa, `icon-${s}.png`));
// maskable: ícone com 80% de área segura sobre o fundo Noite
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0E0C0B" } })
  .composite([{ input: await sharp(icon).resize(410, 410).png().toBuffer(), gravity: "centre" }])
  .png({ compressionLevel: 9 }).toFile(join(pwa, "icon-maskable-512.png"));
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#0E0C0B" } })
  .composite([{ input: await sharp(icon).resize(180, 180).png().toBuffer() }])
  .flatten({ background: "#0E0C0B" }).png({ compressionLevel: 9 }).toFile(join(pwa, "apple-touch-icon.png"));

let total = 0;
for (const j of jobs) total += (await stat(out(j))).size;
console.log(`${jobs.length} arquivos gerados em web/public/revela/, ${(total / 1024).toFixed(0)} KB (sem vídeo).`);
