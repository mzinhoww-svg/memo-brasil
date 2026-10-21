// Gera src/components/memoriesmt/icon-data.ts a partir dos SVGs oficiais do kit (public/icons, public/brand).
import fs from "node:fs";
const dir = new URL("../public/icons/", import.meta.url);
const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/#1C1917/gi, "currentColor");
const out = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
  const svg = fs.readFileSync(new URL(f, dir), "utf8");
  out[f.replace(".svg", "")] = { filled: !/stroke=/.test(svg.split(">")[0]), body: inner(svg) };
}
const selo = fs.readFileSync(new URL("../public/brand/memoriesmt-selo.svg", import.meta.url), "utf8");
const seloPath = selo.match(/ d="([^"]+)"/)[1];
const names = Object.keys(out).map((n) => JSON.stringify(n)).join(" | ");
fs.writeFileSync(
  new URL("../src/components/memoriesmt/icon-data.ts", import.meta.url),
  `// GERADO por scripts/gen-assets.mjs a partir de public/icons e public/brand. Não editar.\nexport type IconName = ${names};\nexport const ICONS: Record<IconName, { filled: boolean; body: string }> = ${JSON.stringify(out, null, 2)};\nexport const SELO_PATH = ${JSON.stringify(seloPath)};\n`,
);
console.log(Object.keys(out).join(","));
