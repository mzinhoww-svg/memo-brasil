/* Revela · service worker. Estratégia:
 * - estáticos (/_next/static, fontes, marca, ícones): cache primeiro;
 * - navegação: rede primeiro; guarda a página visitada; sem rede usa a cópia ou /offline.
 * Os dados (eventos e fotos) vivem no IndexedDB e não passam pelo SW.
 * A versão vem de /sw.js?v=<build>: cada deploy usa um cache novo e o antigo é apagado ao ativar. */
const VERSION = "mm-" + (new URL(self.location.href).searchParams.get("v") || "dev");
const SHELL = ["/", "/entrar", "/criar", "/offline", "/manifest.webmanifest"];
const STATIC = /^\/(_next\/static|fonts|brand|icons|pwa)\//;
const MAX_PAGES = 40; // páginas visitadas guardadas (as mais antigas saem primeiro)

/** /offline nunca é visitada online: sem os scripts dela no cache, a página offline cairia em "Algo deu errado". */
async function warmOffline(cache) {
  try {
    const html = await (await cache.match("/offline"))?.text();
    const urls = new Set(html?.match(/\/_next\/static\/[^"'\\\s<>]+\.(?:js|css)/g) ?? []);
    await Promise.allSettled([...urls].map((u) => cache.add(u)));
  } catch { /* o fallback segue sem os scripts; nada quebra */ }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // uma URL com falha não impede a instalação das outras
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))).then(() => warmOffline(c)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("mm-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function remember(req, res) {
  const cache = await caches.open(VERSION);
  await cache.put(req, res);
  const pages = (await cache.keys()).filter((r) => !STATIC.test(new URL(r.url).pathname) && !SHELL.includes(new URL(r.url).pathname));
  for (const old of pages.slice(0, Math.max(0, pages.length - MAX_PAGES))) await cache.delete(old);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) event.waitUntil(remember(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) event.waitUntil(remember(req, res.clone()));
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
    );
  }
});
