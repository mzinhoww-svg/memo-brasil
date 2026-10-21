import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { openDemo } from "./helpers";
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results/a2-offline-post.json");

for (const offline of [false, true, "reload"] as const) {
  test(`postar com offline=${offline}`, async ({ browser }) => {
    const ctx = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const code = await openDemo(page);
    await page.goto(`/e/${code}/postar`); await page.waitForTimeout(1000);
    if (offline === "reload") { await page.goto(`/e/${code}/agora`); await page.goto(`/e/${code}/postar`); await page.waitForTimeout(800); await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(1500); }
    else if (offline) await ctx.setOffline(true);
    const t0 = Date.now();
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Postar", exact: true }).click();
    const states: string[] = [];
    let ok = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      const t = await page.locator("main").innerText();
      const s = /Sua visão entrou na história/.test(t) ? "publicado" : /Guardando/.test(t) ? "guardando" : "outro";
      if (states[states.length - 1] !== s) states.push(s + "@" + (Date.now() - t0) + "ms");
      if (s === "publicado") { ok = true; break; }
    }
    const db = await page.evaluate(() => new Promise<number>((r) => { const q = indexedDB.open("memoriesmt"); q.onsuccess = () => { const c = q.result.transaction("photos").objectStore("photos").count(); c.onsuccess = () => r(c.result); }; }));
    const res = JSON.parse(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "{}");
    res[`offline_${offline}`] = { ok, states, photosInDb: db, finalText: (await page.locator("main").innerText()).slice(-200) };
    fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
    await ctx.close();
  });
}
