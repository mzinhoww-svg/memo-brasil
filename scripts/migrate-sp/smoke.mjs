// Smoke SOMENTE LEITURA do app apontando para o projeto de destino (chamado por smoke_app.py).
// Abre /, /e/<código> (prévia do convite; o app cria um convidado anônimo) e /entrar (tela do código);
// conta as respostas do host do Supabase.
// Uso: SMOKE_BASE=http://localhost:3270 SMOKE_CODE=<código> SMOKE_SUPABASE_HOST=<ref>.supabase.co node scripts/migrate-sp/smoke.mjs
import { createRequire } from "node:module";
const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const base = process.env.SMOKE_BASE, code = process.env.SMOKE_CODE, host = process.env.SMOKE_SUPABASE_HOST;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const fs = await import("node:fs");
const exe = ["/usr/bin/google-chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ proxy, ...(exe ? { executablePath: exe } : {}) });
const page = await (await browser.newContext({ ignoreHTTPSErrors: false })).newPage();
const supa = [];
page.on("response", (r) => { const u = new URL(r.url()); if (u.host === host) supa.push({ path: u.pathname.replace(/[A-Z0-9]{6,}/g, "…"), status: r.status() }); });
const out = {};
for (const [name, path] of [["home", "/"], ["convite", `/e/${code}`], ["entrar", "/entrar"]]) {
  const t = Date.now();
  const r = await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 });
  const h1 = await page.locator("h1").first().textContent({ timeout: 15000 }).catch(() => null);
  const txt = (await page.locator("body").innerText()).slice(0, 4000);
  out[name] = { http: r?.status(), ms: Date.now() - t, h1_presente: !!h1,
    erro_na_tela: /não encontrad|erro|indisponível|algo deu errado/i.test(txt) };
}
const cookies = await page.context().cookies();
out.cookies_sb = cookies.filter((c) => c.name.startsWith("sb-")).map((c) => c.name.replace(/sb-([a-z]{6})[a-z]+/, "sb-$1…"));
out.respostas_supabase = supa.reduce((a, x) => { const k = `${x.status} ${x.path}`; a[k] = (a[k] || 0) + 1; return a; }, {});
await page.screenshot({ path: process.env.SMOKE_SHOT || "/dev/null" }).catch(() => {});
await browser.close();
console.log(JSON.stringify(out, null, 1));
