import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createViaWizard, postViaFile } from "./helpers";

const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results");
const PAY = "<img src=x onerror=__xss=1>";

test("XSS em texto de usuario e URL; rede e console", async ({ page, context }) => {
  test.setTimeout(150_000);
  const out: Record<string, unknown> = {};
  const external = new Set<string>();
  const consoleMsgs: string[] = [];
  const all = new Set<string>();
  page.on("request", (r) => { const u = new URL(r.url()); all.add(`${u.origin}${u.pathname.replace(/\/e\/[A-Z0-9]{8}/, "/e/CODE").replace(/\/painel\/[0-9a-f-]+/, "/painel/ID")}`); if (u.hostname !== "localhost") external.add(r.url()); });
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on("dialog", async (d) => { out.dialog = d.message(); await d.dismiss(); });

  const { code, id } = await createViaWizard(page, { title: PAY, reveal: "desligada" });
  // nome do anfitriao e local com payload via configuracoes
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByLabel("Aviso curto").fill(PAY);
  await page.getByRole("button", { name: "Publicar aviso" }).click({ timeout: 5000 });
  await page.goto(`/painel/${id}/momentos`);
  await page.getByLabel("Novo momento").fill(PAY);
  await page.getByRole("button", { name: "Adicionar momento" }).click({ timeout: 5000 });
  await postViaFile(page, code);
  for (const r of [`/e/${code}?mesa=${encodeURIComponent(PAY)}`, `/e/${code}/agora?agora=1&mesa=<script>x</script>`, `/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/retrospectiva`, `/painel/${id}`, `/painel/${id}/momentos`, `/painel/${id}/conteudo`, `/painel/${id}/convidados`, `/painel/${id}/downloads`, `/painel/${id}/configuracoes`, `/painel/${id}/qr`, "/", "/entrar", "/criar", "/offline", "/master", "/design", `/e/..%2f..%2f`, "/e/<img src=x onerror=alert(1)>"]) {
    await page.goto(r, { waitUntil: "networkidle" }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
  out.xssFlag = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? null);
  out.bodyHasLiteral = (await page.content()).includes("&lt;img src=x") || (await page.content()).includes("&lt;img");
  out.externalRequests = [...external];
  out.requestOrigins = [...all].sort();
  out.consoleMsgs = consoleMsgs.slice(0, 30);
  out.storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage), session: Object.keys(sessionStorage),
    idb: (await indexedDB.databases()).map((d) => d.name),
    caches: await caches.keys(),
  }));
  // pesquisa de PII no cache do SW
  out.swCacheUrls = await page.evaluate(async () => { const o: string[] = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) o.push(new URL(r.url).pathname); } return o; });
  fs.writeFileSync(path.join(OUT, "a3-xss-network.json"), JSON.stringify(out, null, 2));
  expect(out.xssFlag).toBeNull();
  void context;
});
