// Uso: node capture.mjs <baseUrl> <outDir> <prefixo>  — capturas da home (360/390/1280) e de /exemplo e /eventos, sem sessão.
import { chromium } from "playwright";
import fs from "node:fs";
const [base, out, prefix] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of [[360, 740], [390, 844], [1280, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${prefix}-home-${w}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`${prefix} ${w}px rolagem horizontal: ${overflow}`);
  if (w === 360) {
    for (const path of ["/exemplo", "/eventos"]) {
      const r = await page.goto(base + path, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${out}/${prefix}-${path.slice(1)}-${w}.png`, fullPage: true });
      console.log(`${prefix} ${path} HTTP ${r?.status()}`);
    }
  }
  await page.close();
}
await browser.close();
