/* Auditoria A2: 200 fotos: "Ver mais" até o fim, /voce com 200 fotos próprias, ZIP do álbum. Produção, porta 3312. */
import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results/a2-perf-200fotos-b.json");

test("200 fotos: carregar tudo, voce e zip", async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/([A-Z0-9]{8})\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  const seedInfo = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((r) => { const q = indexedDB.open("memoriesmt"); q.onsuccess = () => r(q.result); });
    const ev = await new Promise<{ id: string; hostId: string }>((r) => { const k = db.transaction("events").objectStore("events").getAll(); k.onsuccess = () => r(k.result[0]); });
    const bufs: ArrayBuffer[] = [];
    for (let s = 0; s < 8; s++) {
      const c = document.createElement("canvas"); c.width = 1200; c.height = 1600; const x = c.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, 1200, 1600); g.addColorStop(0, `hsl(${s * 40} 40% 50%)`); g.addColorStop(1, `hsl(${s * 40 + 80} 50% 30%)`); x.fillStyle = g; x.fillRect(0, 0, 1200, 1600);
      for (let i = 0; i < 300; i++) { x.fillStyle = `hsla(${(i * 37 + s * 11) % 360} 60% ${20 + (i % 60)}% / .6)`; x.beginPath(); x.arc((i * 97 * (s + 1)) % 1200, (i * 131 + s * 53) % 1600, 10 + (i % 90), 0, 7); x.fill(); }
      const img = x.getImageData(0, 0, 1200, 1600); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 24; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } x.putImageData(img, 0, 0);
      const b: Blob = await new Promise((r) => c.toBlob((q) => r(q!), "image/jpeg", 0.85));
      bufs.push(await b.arrayBuffer());
    }
    const tx = db.transaction(["photos", "photoData"], "readwrite");
    for (let i = 0; i < 188; i++) {
      const pid = crypto.randomUUID();
      tx.objectStore("photos").put({ id: pid, eventId: ev.id, authorId: i < 150 ? ev.hostId : "demo-ana", authorName: i < 150 ? "Emy" : "Ana", createdAt: Date.now() - i * 60_000, moment: ["Chegada", "O sim", "Pôr do sol", "Pista"][i % 4], status: "visivel", reports: 0, highlighted: false });
      tx.objectStore("photoData").put({ bytes: bufs[i % 8], type: "image/jpeg" }, pid);
    }
    await new Promise<void>((r) => { tx.oncomplete = () => r(); });
    return { id: ev.id, avgKB: Math.round(bufs.reduce((a, b) => a + b.byteLength, 0) / 8 / 1024), totalMB: +(bufs.reduce((a, b) => a + b.byteLength, 0) / 8 * 188 / 1048576).toFixed(1) };
  });
  const res: Record<string, unknown> = { seedInfo };
  const metrics = async (c: import("@playwright/test").CDPSession) => { const m = await c.send("Performance.getMetrics"); const g = Object.fromEntries(m.metrics.map((x) => [x.name, x.value])); return { jsHeapMB: +(g.JSHeapUsedSize / 1048576).toFixed(1), nodes: g.Nodes, layoutCount: g.LayoutCount, taskSec: +g.TaskDuration.toFixed(2), scriptSec: +g.ScriptDuration.toFixed(2) }; };

  // agora: Ver mais ate o fim
  {
    const p = await ctx.newPage(); const c = await ctx.newCDPSession(p); await c.send("Performance.enable");
    const t0 = Date.now();
    await p.goto(`/e/${code}/agora`);
    await p.waitForSelector(".mm-post img[src^=blob]");
    const first = Date.now() - t0;
    let clicks = 0;
    const tc = Date.now();
    while (await p.getByRole("button", { name: "Ver mais fotos" }).count()) { await p.getByRole("button", { name: "Ver mais fotos" }).click(); clicks++; await p.waitForTimeout(150); }
    await p.waitForFunction(() => { const im = [...document.querySelectorAll(".mm-post img")]; return im.length >= 200 && im.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0); }, null, { timeout: 120000, polling: 250 }).catch(() => undefined);
    const all = Date.now() - tc;
    const dom = await p.evaluate(() => ({ posts: document.querySelectorAll(".mm-post").length, imgsLoaded: [...document.querySelectorAll(".mm-post img")].filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length, nodes: document.getElementsByTagName("*").length, pageH: document.documentElement.scrollHeight }));
    await p.waitForTimeout(1000);
    const m = await metrics(c);
    const sc0 = Date.now();
    await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => r(null))); } });
    res.agora200 = { firstImgMs: first, clicksVerMais: clicks, verMaisToAllLoadedMs: all, dom, afterLoad: m, scrollToEndMs: Date.now() - sc0, afterScroll: await metrics(c) };
    await p.close();
  }
  // voce: 150 fotos proprias, sem paginacao
  {
    const p = await ctx.newPage(); const c = await ctx.newCDPSession(p); await c.send("Performance.enable");
    const t0 = Date.now();
    await p.goto(`/e/${code}/voce`);
    await p.waitForFunction(() => document.querySelectorAll(".app-thumb img").length >= 150 || document.querySelectorAll("img[src^=blob]").length >= 150, null, { timeout: 120000, polling: 250 }).catch(() => undefined);
    const ms = Date.now() - t0;
    await p.waitForTimeout(1000);
    res.voce150 = { imgs: await p.evaluate(() => document.querySelectorAll("img[src^=blob]").length), toAllRenderedMs: ms, afterLoad: await metrics(c), pageH: await p.evaluate(() => document.documentElement.scrollHeight) };
    await p.screenshot({ path: path.resolve(__dirname, "../../docs/audit/evidence/screenshots/a2-200fotos-voce150-390-dia.png") });
    await p.close();
  }
  // zip
  {
    const p = await ctx.newPage(); const c = await ctx.newCDPSession(p); await c.send("Performance.enable");
    await p.goto(`/painel/${seedInfo.id}/downloads`);
    await p.waitForTimeout(800);
    const t0 = Date.now();
    const dl = p.waitForEvent("download", { timeout: 180000 });
    await p.getByRole("button", { name: "Baixar o álbum (ZIP)" }).click();
    const d = await dl;
    const tmp = await d.path();
    res.zip = { ms: Date.now() - t0, name: d.suggestedFilename(), sizeMB: tmp ? +(fs.statSync(tmp).size / 1048576).toFixed(1) : null, after: await metrics(c) };
    await p.close();
  }
  fs.writeFileSync(OUT, JSON.stringify({ env: "Apple M4, Chromium Playwright, produção 3312, 390x844@3x, sem throttling", res }, null, 1));
  await ctx.close();
});
