/* Auditoria A2 (performance): métricas por rota, requisições, JS por rota, fonte, e 200 fotos no feed.
 * Rodar contra o build de PRODUÇÃO sem relógio de teste (porta 3312). */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results");
const save = (n: string, v: unknown) => fs.writeFileSync(path.join(OUT, n), JSON.stringify(v, null, 1));

const OBS = () => {
  const w = window as unknown as { __p: Record<string, unknown> };
  w.__p = { lcp: 0, cls: 0, fcp: 0, long: [] as number[], inp: 0, lcpEl: "" };
  const po = (type: string, cb: (e: PerformanceEntry & Record<string, number & string>) => void, extra: object = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach((e) => cb(e as never))).observe({ type, buffered: true, ...extra } as never); } catch {} };
  po("largest-contentful-paint", (e) => { w.__p.lcp = e.startTime; w.__p.lcpEl = (e as unknown as { element?: Element }).element?.tagName + ":" + ((e as unknown as { url?: string }).url || "").slice(0, 40); });
  po("layout-shift", (e) => { if (!(e as unknown as { hadRecentInput: boolean }).hadRecentInput) (w.__p.cls as number) += (e as unknown as { value: number }).value; });
  po("paint", (e) => { if (e.name === "first-contentful-paint") w.__p.fcp = e.startTime; });
  po("longtask", (e) => { (w.__p.long as number[]).push(e.duration); });
  po("event", (e) => { if ((e as unknown as { interactionId: number }).interactionId) w.__p.inp = Math.max(w.__p.inp as number, e.duration); }, { durationThreshold: 16 });
};

async function throttle(page: Page, mode: "mobile" | "desktop") {
  const c = await page.context().newCDPSession(page);
  await c.send("Network.enable");
  await c.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (mode === "mobile") {
    await c.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await c.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  }
  return c;
}

async function seed(ctx: BrowserContext, page: Page) {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/([A-Z0-9]{8})\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  const id = await page.evaluate(() => new Promise<string>((r) => { const q = indexedDB.open("memoriesmt"); q.onsuccess = () => { const k = q.result.transaction("events").objectStore("events").getAllKeys(); k.onsuccess = () => r(String((k.result as string[])[0])); }; }));
  return { code, id };
}

for (const mode of ["mobile", "desktop"] as const) {
  test(`métricas por rota (${mode})`, async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: mode === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mode === "mobile" ? 3 : 1, isMobile: mode === "mobile", hasTouch: mode === "mobile" });
    const page = await ctx.newPage();
    const { code, id } = await seed(ctx, page);
    await ctx.addInitScript(OBS);
    const routes = ["/", "/entrar", "/criar", "/design", `/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/postar`, `/painel/${id}`, `/painel/${id}/downloads`, `/painel/${id}/qr`];
    const rows: unknown[] = [];
    for (const r of routes) {
      const p = await ctx.newPage();
      await throttle(p, mode);
      const reqs: { url: string; type: string; size: number; from: string }[] = [];
      const errs: string[] = [];
      p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(m.type() + ": " + m.text().slice(0, 160)); });
      p.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 160)));
      p.on("response", async (res) => { try { const b = await res.body().catch(() => Buffer.alloc(0)); const h = res.headers(); reqs.push({ url: res.url().replace(/^https?:\/\/[^/]+/, ""), type: res.request().resourceType(), size: Number(h["content-length"] || b.length), from: res.fromServiceWorker() ? "sw" : "net" }); } catch {} });
      const t0 = Date.now();
      await p.goto(r, { waitUntil: "load" });
      await p.waitForTimeout(3500);
      const m = await p.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const pp = (window as unknown as { __p: Record<string, unknown> }).__p;
        return { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round(pp.fcp as number), lcp: Math.round(pp.lcp as number), lcpEl: pp.lcpEl, cls: +(pp.cls as number).toFixed(4), tbtLike: Math.round((pp.long as number[]).reduce((a, d) => a + Math.max(0, d - 50), 0)), longTasks: (pp.long as number[]).length, dom: document.getElementsByTagName("*").length };
      });
      // INP simples: clique em primeiro botão seguro
      const byType: Record<string, number> = {};
      for (const q of reqs) byType[q.type] = (byType[q.type] || 0) + q.size;
      rows.push({ route: r.replace(code, "CODE").replace(id, "ID"), ...m, requests: reqs.length, bytes: reqs.reduce((a, b) => a + b.size, 0), byType, jsFiles: reqs.filter((q) => q.type === "script").map((q) => [q.url.split("/").pop(), q.size]), fonts: reqs.filter((q) => q.type === "font").map((q) => [q.url.split("/").pop(), q.size]), errors: errs.slice(0, 4), wall: Date.now() - t0 });
      await p.close();
    }
    save(`a2-perf-routes-${mode}.json`, { env: { machine: "Apple M4, macOS 25.6", browser: "Chromium (Playwright 1.64 bundle)", build: "next start produção, TEST_CLOCK=0, porta 3312", throttle: mode === "mobile" ? "CPU 4x, rede 1,6 Mbps down/750 Kbps up/150 ms RTT, cache desligado, SW bloqueado, 390x844 @3x" : "sem throttling, cache desligado, SW bloqueado, 1440x900" }, rows });
    await ctx.close();
  });
}

test("200 fotos no feed", async ({ browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const { code, id } = await seed(ctx, page);
  // gera 12 JPEGs 1200x1600 q0.85 com conteúdo variado (ruído + formas) e insere 188 fotos
  const info = await page.evaluate(async () => {
    const mk = async (seed: number) => {
      const c = document.createElement("canvas"); c.width = 1200; c.height = 1600; const x = c.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, 1200, 1600); g.addColorStop(0, `hsl(${seed * 30} 40% 50%)`); g.addColorStop(1, `hsl(${seed * 30 + 80} 50% 30%)`); x.fillStyle = g; x.fillRect(0, 0, 1200, 1600);
      for (let i = 0; i < 400; i++) { x.fillStyle = `hsla(${(i * 37 + seed * 11) % 360} 60% ${20 + (i % 60)}% / .6)`; x.beginPath(); x.arc((i * 97 * (seed + 1)) % 1200, (i * 131 + seed * 53) % 1600, 10 + (i % 90), 0, 7); x.fill(); }
      const img = x.getImageData(0, 0, 1200, 1600); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 24; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } x.putImageData(img, 0, 0);
      const b: Blob = await new Promise((r) => c.toBlob((q) => r(q!), "image/jpeg", 0.85));
      return b.arrayBuffer();
    };
    const bufs = await Promise.all(Array.from({ length: 12 }, (_, i) => mk(i)));
    const db: IDBDatabase = await new Promise((r) => { const q = indexedDB.open("memoriesmt"); q.onsuccess = () => r(q.result); });
    const ev = await new Promise<{ id: string }>((r) => { const k = db.transaction("events").objectStore("events").getAll(); k.onsuccess = () => r(k.result[0]); });
    const tx = db.transaction(["photos", "photoData"], "readwrite");
    const MOM = ["Chegada", "O sim", "Pôr do sol", "Pista"];
    for (let i = 0; i < 188; i++) {
      const pid = crypto.randomUUID();
      tx.objectStore("photos").put({ id: pid, eventId: ev.id, authorId: "demo-ana", authorName: "Ana", createdAt: Date.now() - i * 60_000, moment: MOM[i % 4], caption: i % 3 === 0 ? "Ninguém segurou a emoção." : undefined, tableLabel: "Mesa 8", status: "visivel", reports: 0, highlighted: false });
      tx.objectStore("photoData").put({ bytes: bufs[i % 12], type: "image/jpeg" }, pid);
    }
    await new Promise<void>((r) => { tx.oncomplete = () => r(); });
    return { avgBytes: Math.round(bufs.reduce((a, b) => a + b.byteLength, 0) / 12), min: Math.min(...bufs.map((b) => b.byteLength)), max: Math.max(...bufs.map((b) => b.byteLength)) };
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  const results: Record<string, unknown> = { jpegBytesSample: info };
  for (const [name, url] of [["agora", `/e/${code}/agora`], ["explorar", `/e/${code}/explorar`], ["voce", `/e/${code}/voce`], ["painel-conteudo", `/painel/${id}/conteudo`]] as const) {
    const p = await ctx.newPage();
    await p.addInitScript(OBS);
    const c = await ctx.newCDPSession(p);
    await c.send("Performance.enable");
    const t0 = Date.now();
    await p.goto(url, { waitUntil: "load" });
    const firstPost = await p.waitForSelector("img[src^=blob]", { timeout: 30000 }).then(() => Date.now() - t0).catch(() => -1);
    // espera todas as imagens carregarem
    const allMs = await p.waitForFunction(() => { const im = [...document.querySelectorAll("img")].filter((i) => i.src.startsWith("blob:")); return im.length >= 150 && im.every((i) => i.complete && i.naturalWidth > 0) ? im.length : false; }, null, { timeout: 40000, polling: 250 }).then(() => Date.now() - t0).catch(() => -1);
    await p.waitForTimeout(1500);
    const m = await c.send("Performance.getMetrics");
    const g = Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
    const dom = await p.evaluate(() => ({ imgs: document.querySelectorAll("img").length, blobImgs: [...document.querySelectorAll("img")].filter((i) => i.src.startsWith("blob:")).length, nodes: document.getElementsByTagName("*").length, lazy: [...document.querySelectorAll("img")].filter((i) => i.loading === "lazy").length, heapMB: +(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize) / 1048576).toFixed(1), pageH: document.documentElement.scrollHeight, p: (window as unknown as { __p: object }).__p }));
    // rolagem até o fim
    const sc0 = Date.now();
    await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => requestAnimationFrame(() => r(null))); } });
    const scrollMs = Date.now() - sc0;
    const m2 = await c.send("Performance.getMetrics");
    const g2 = Object.fromEntries(m2.metrics.map((x) => [x.name, x.value]));
    results[name] = { firstImgMs: firstPost, allImgsLoadedMs: allMs, scrollToEndMs: scrollMs, dom, cdpAfterLoad: { jsHeapMB: +(g.JSHeapUsedSize / 1048576).toFixed(1), jsHeapTotalMB: +(g.JSHeapTotalSize / 1048576).toFixed(1), nodes: g.Nodes, layoutCount: g.LayoutCount, taskSec: +g.TaskDuration.toFixed(2), scriptSec: +g.ScriptDuration.toFixed(2) }, cdpAfterScroll: { jsHeapMB: +(g2.JSHeapUsedSize / 1048576).toFixed(1), taskSec: +g2.TaskDuration.toFixed(2) } };
    console.log(name, JSON.stringify(results[name]).slice(0, 400));
    await p.screenshot({ path: path.resolve(OUT, "../screenshots", `a2-200fotos-${name}-390-dia.png`) });
    await p.close();
  }
  save("a2-perf-200fotos.json", { env: "Apple M4, Chromium Playwright, produção 3312, 390x844@3x, sem throttling, SW bloqueado, 200 fotos JPEG 1200x1600 q0.85", results });
  await ctx.close();
});
