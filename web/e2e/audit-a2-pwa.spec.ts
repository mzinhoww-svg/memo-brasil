/* Auditoria A2 (PWA): manifest, service worker, offline real, persistência, IndexedDB indisponível, atualização de versão. */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { setTheme } from "./helpers";

const EV = path.resolve(__dirname, "../../docs/audit/evidence");
const OUT = path.join(EV, "test-results/a2-pwa.json");
const SHOTS = path.join(EV, "screenshots");
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const log: Record<string, unknown> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const save = (k: string, v: unknown) => { log[k] = v; fs.writeFileSync(OUT, JSON.stringify(log, null, 1)); };

async function swReady(page: Page) { return page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, script: r.active?.scriptURL, state: r.active?.state }; }); }
async function cacheDump(page: Page) {
  return page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search);
    return out;
  });
}
async function bodyHas(page: Page, text: string | RegExp) { try { await expect(page.locator("body")).toContainText(text, { timeout: 5000 }); return true; } catch { return false; } }

test("manifest e ícones", async ({ request, page }) => {
  const res = await request.get("/manifest.webmanifest");
  const m = await res.json();
  const icons: unknown[] = [];
  for (const i of m.icons) {
    const r = await request.get(i.src);
    const b = await r.body();
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    icons.push({ src: i.src, declared: i.sizes, purpose: i.purpose, status: r.status(), actual: `${w}x${h}`, bytes: b.length, ct: r.headers()["content-type"] });
  }
  const apple = await request.get("/pwa/apple-touch-icon.png");
  const ab = await apple.body();
  await page.goto("/");
  const links = await page.evaluate(() => ({ manifest: document.querySelector("link[rel=manifest]")?.getAttribute("href"), themeColors: [...document.querySelectorAll("meta[name=theme-color]")].map((m) => m.getAttribute("content") + "|" + m.getAttribute("media")), apple: document.querySelector("link[rel=apple-touch-icon]")?.getAttribute("href"), viewport: document.querySelector("meta[name=viewport]")?.getAttribute("content") }));
  const sw = await request.get("/sw.js");
  save("manifest", { manifest: m, icons, apple: { status: apple.status(), actual: `${ab.readUInt32BE(16)}x${ab.readUInt32BE(20)}` }, head: links, sw: { status: sw.status(), headers: { cc: sw.headers()["cache-control"], allowed: sw.headers()["service-worker-allowed"], ct: sw.headers()["content-type"] }, bytes: (await sw.body()).length } });
  expect(res.status()).toBe(200);
});

test("service worker: registro, cache, offline", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const res: Record<string, unknown> = {};
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  await page.goto("/");
  res.registration = await swReady(page);
  // estado imediatamente após a ativação (primeira visita): o que já está no cache?
  res.cacheAfterFirstVisit = await cacheDump(page);
  res.controlledAfterFirstLoad = await page.evaluate(() => !!navigator.serviceWorker.controller);

  // 1a. vai offline logo após a 1a visita, sem recarregar online antes
  await ctx.setOffline(true);
  const r1 = await page.reload().then(() => true).catch((e) => String(e).slice(0, 80));
  res.firstVisitReloadOffline = { navigated: r1, hasHeading: await bodyHas(page, "Seu evento pelo olhar de cada convidado."), interactive: await page.getByRole("link", { name: "Experimentar câmera" }).isEnabled().catch(() => false) };
  await page.screenshot({ path: path.join(SHOTS, "a2-pwa-offline-primeira-visita-390-dia.png") });
  await ctx.setOffline(false);

  // 1b. fluxo normal: visita páginas online
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/([A-Z0-9]{8})\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  const visited = ["agora", "explorar", "voce", "postar"];
  for (const v of visited) { await page.goto(`/e/${code}/${v}`); await page.waitForTimeout(500); }
  await page.goto("/entrar"); await page.goto("/criar"); await page.waitForTimeout(500);
  const id = await page.evaluate(() => new Promise<string>((r) => { const q = indexedDB.open("memoriesmt"); q.onsuccess = () => { const k = q.result.transaction("events").objectStore("events").getAllKeys(); k.onsuccess = () => r(String((k.result as string[])[0])); }; }));
  await page.goto(`/painel/${id}`); await page.waitForTimeout(500);
  res.cacheAfterVisits = await cacheDump(page);

  // 2. offline: páginas visitadas
  await ctx.setOffline(true);
  const offlineVisited: Record<string, unknown> = {};
  for (const v of [`/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/postar`, "/entrar", "/criar", `/painel/${id}`, "/"]) {
    const ok = await page.goto(v).then((r) => r?.status() ?? 0).catch((e) => "ERR " + String(e).slice(0, 60));
    await page.waitForTimeout(700);
    const t = await page.locator("body").innerText();
    offlineVisited[v] = { status: ok, offlinePage: /Sem sinal agora/.test(t), h1: await page.locator("h1").first().textContent().catch(() => null), hydrated: await page.evaluate(() => !!document.querySelector("#conteudo") && document.readyState === "complete") };
  }
  res.offlineVisited = offlineVisited;
  await page.goto(`/e/${code}/agora`); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "a2-pwa-offline-agora-390-dia.png") });
  const posts = await page.locator(".rv-post").count();
  res.offlineAgoraPosts = posts;

  // 3. offline: rotas nunca visitadas
  const never: Record<string, unknown> = {};
  for (const v of [`/e/${code}/retrospectiva`, `/painel/${id}/qr`, `/e/ABCDEFGH/agora`, "/design"]) {
    const st = await page.goto(v).then((r) => r?.status() ?? 0).catch((e) => "ERR " + String(e).slice(0, 60));
    await page.waitForTimeout(600);
    never[v] = { status: st, offlinePage: /Sem sinal agora/.test(await page.locator("body").innerText()) };
  }
  res.offlineNeverVisited = never;
  await page.screenshot({ path: path.join(SHOTS, "a2-pwa-offline-nunca-visitada-390-dia.png") });

  // 3b. navegação client-side offline (links internos) para rota visitada e não visitada
  await page.goto(`/e/${code}/agora`); await page.waitForTimeout(600);
  const clientNav: Record<string, unknown> = {};
  for (const [name, href] of [["Explorar", `/e/${code}/explorar`], ["Você", `/e/${code}/voce`]] as const) {
    await page.locator(`a[href='${href}']`).first().click().catch(() => undefined);
    await page.waitForTimeout(900);
    clientNav[name] = { url: page.url().replace(/^https?:\/\/[^/]+/, ""), h1: await page.locator("h1").first().textContent().catch(() => null), offlinePage: /Sem sinal agora/.test(await page.locator("body").innerText()) };
    await page.goto(`/e/${code}/agora`); await page.waitForTimeout(400);
  }
  res.clientNavOffline = clientNav;

  // 4. postar foto offline e reabrir offline
  await page.goto(`/e/${code}/postar`); await page.waitForTimeout(500);
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "O sim", exact: true }).click();
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  const posted = await page.getByText("Sua visão entrou na história.").isVisible({ timeout: 8000 }).catch(() => false);
  res.postOffline = { posted };
  await page.screenshot({ path: path.join(SHOTS, "a2-pwa-offline-postado-390-dia.png") });
  await page.goto(`/e/${code}/agora`); await page.waitForTimeout(800);
  const afterPost = await page.locator(".rv-post").count();
  const dbCount = await page.evaluate(() => new Promise<number>((r) => { const q = indexedDB.open("memoriesmt"); q.onsuccess = () => { const c = q.result.transaction("photos").objectStore("photos").count(); c.onsuccess = () => r(c.result); }; }));
  res.postOffline = { posted, postsInFeedAfter: afterPost, postsBefore: posts, photosInDb: dbCount };
  await page.reload(); await page.waitForTimeout(800);
  res.reopenOfflinePosts = await page.locator(".rv-post").count();

  // 5. reconectar
  await ctx.setOffline(false);
  await page.goto(`/e/${code}/agora`); await page.waitForTimeout(800);
  res.afterReconnectPosts = await page.locator(".rv-post").count();
  const reqs: string[] = [];
  page.on("request", (r) => { if (!/\/_next\/|\/fonts\/|\/brand\/|\/icons\/|\/pwa\//.test(r.url())) reqs.push(r.method() + " " + r.url().replace(/^https?:\/\/[^/]+/, "")); });
  await page.waitForTimeout(3000);
  res.requestsAfterReconnect3s = reqs;

  // 6. persistência após limpar caches do SW
  await page.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
  res.postsAfterClearCache = (await page.reload().then(() => page.waitForTimeout(800)).then(() => page.locator(".rv-post").count()));
  await ctx.setOffline(true);
  const afterClear = await page.goto(`/e/${code}/agora`).then((r) => r?.status() ?? 0).catch((e) => "ERR " + String(e).slice(0, 60));
  res.offlineAfterClearCache = { result: afterClear, body: (await page.locator("body").innerText().catch(() => "")).slice(0, 80) };
  await page.screenshot({ path: path.join(SHOTS, "a2-pwa-offline-sem-cache-390-dia.png") });
  await ctx.setOffline(false);
  res.consoleErrors = errs.slice(0, 10);
  save("serviceWorker", res);
  await ctx.close();
});

test("service worker: falha parcial na instalação, atualização de versão e limite de páginas", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  const res: Record<string, unknown> = {};
  await page.goto("/offline");
  await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  // versão A
  const reg = async (v: string) => page.evaluate(async (v) => {
    const r = await navigator.serviceWorker.register(`/sw.js?v=${v}`);
    const sw = r.installing || r.waiting || r.active!;
    await new Promise<void>((res) => { if (sw.state === "activated") return res(); sw.addEventListener("statechange", () => { if (sw.state === "activated") res(); }); });
    return { script: sw.scriptURL, state: sw.state };
  }, v);
  res.regA = await reg("AAA");
  res.cachesAfterA = Object.keys(await cacheDump(page));
  await page.reload(); await page.goto("/entrar"); await page.goto("/criar");
  res.cachesAfterVisitsA = await cacheDump(page);
  res.regB = await reg("BBB");
  await page.waitForTimeout(800);
  res.cachesAfterB = await cacheDump(page);
  res.controllerAfterB = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  res.registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => ({ scope: r.scope, active: r.active?.scriptURL, waiting: r.waiting?.scriptURL, installing: r.installing?.scriptURL })));

  // limite de páginas: visita 50 URLs /e/XXXXXXXX/agora (servidor devolve 200 no shell) e conta
  await page.evaluate(async () => { for (const i of Array.from({ length: 50 }, (_, n) => n)) await fetch(`/e/PAGE${String(i).padStart(4, "0")}/agora`, { headers: { accept: "text/html" } }); });
  await page.waitForTimeout(1500);
  const d = await cacheDump(page);
  const cur = Object.keys(d).find((k) => k.includes("BBB"))!;
  res.pagesCachedAfter50Fetches = { cache: cur, total: d[cur].length, eventPages: d[cur].filter((u) => /^\/e\//.test(u)).length };
  save("swUpdate", res);
  await ctx.close();
});

test("falha parcial: URL do shell indisponível não impede instalação", async ({ browser }) => {
  // simula o servidor falhando para /criar no momento da instalação
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  await page.route("**/criar", (r) => r.fulfill({ status: 500, body: "x" }));
  await page.goto("/offline");
  const ready = await swReady(page);
  const d = await cacheDump(page);
  save("swPartialInstall", { ready, cache: d, note: "/criar respondeu 500 durante a instalação" });
  await ctx.close();
});

test("IndexedDB indisponível", async ({ browser }) => {
  for (const mode of ["undefined", "throws"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await setTheme(page, "dia");
    await page.addInitScript((m) => {
      if (m === "undefined") { Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true }); }
      else { const e = () => { throw new DOMException("blocked", "SecurityError"); }; Object.defineProperty(window, "indexedDB", { value: { open: e, deleteDatabase: e }, configurable: true }); }
    }, mode);
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
    await page.goto("/"); await page.waitForTimeout(1200);
    const res: Record<string, unknown> = { homeText: (await page.locator("body").innerText()).slice(0, 500) };
    await page.screenshot({ path: path.join(SHOTS, `a2-idb-${mode}-home-390-dia.png`) });
    const demo = page.getByRole("link", { name: "Experimentar câmera" });
    res.demoEnabled = await demo.isEnabled();
    if (res.demoEnabled) {
      await demo.click(); await page.waitForTimeout(2500);
      res.afterDemoUrl = page.url().replace(/^https?:\/\/[^/]+/, "");
      res.afterDemoText = (await page.locator("body").innerText()).slice(0, 400);
      await page.screenshot({ path: path.join(SHOTS, `a2-idb-${mode}-demo-390-dia.png`) });
      await page.reload(); await page.waitForTimeout(1200);
      res.afterReloadUrl = page.url().replace(/^https?:\/\/[^/]+/, "");
      res.afterReloadText = (await page.locator("body").innerText()).slice(0, 300);
    }
    await page.goto("/criar"); await page.getByLabel("Nome que os convidados vão ver").fill("Teste");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: /Criar evento/ }).click();
    await page.waitForTimeout(2500);
    res.wizardEnd = { url: page.url().replace(/^https?:\/\/[^/]+/, ""), text: (await page.locator("body").innerText()).slice(0, 300) };
    await page.screenshot({ path: path.join(SHOTS, `a2-idb-${mode}-criar-390-dia.png`) });
    res.errors = errs.slice(0, 6);
    save(`idb_${mode}`, res);
    await ctx.close();
  }
});
