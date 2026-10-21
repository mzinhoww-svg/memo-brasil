/* MemoriesMT · service worker. Estratégia:
 * - estáticos (/_next/static, fontes, marca, ícones): cache primeiro;
 * - navegação: rede primeiro; guarda a página visitada; sem rede usa a cópia ou /offline.
 * Os dados (eventos e fotos) vivem no IndexedDB e não passam pelo SW. */
const VERSION = "mm-v1";
const SHELL = ["/", "/entrar", "/criar", "/offline", "/manifest.webmanifest"];
const STATIC = /^\/(_next\/static|fonts|brand|icons|pwa)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (STATIC.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
    );
  }
});
