// Gera os PNGs do PWA a partir dos SVGs oficiais (ícone do app) com o Chromium do Playwright.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const icone = fs.readFileSync(new URL("../public/brand/memoriesmt-icone-app.svg", import.meta.url), "utf8");
const mask = fs.readFileSync(new URL("../public/pwa/icon-maskable.svg", import.meta.url), "utf8");
const jobs = [
  ["icon-192.png", icone, 192],
  ["icon-512.png", icone, 512],
  ["icon-maskable-512.png", mask, 512],
  ["apple-touch-icon.png", mask, 180],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, svg, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg.replace(/width="\d+" height="\d+"/, "")}`);
  await page.screenshot({ path: new URL(`../public/pwa/${name}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
console.log(jobs.map((j) => j[0]).join(", "));
