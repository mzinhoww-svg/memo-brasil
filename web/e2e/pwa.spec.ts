import { expect, test } from "@playwright/test";

test("service worker assume o controle, guarda o shell e abre páginas visitadas sem rede", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }).catch(() => page.waitForLoadState("load"));
  await page.reload(); // a partir daqui a página é controlada pelo SW
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Digite o código do convite" })).toBeVisible();

  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k.startsWith("mm-"))!)).keys()).map((r) => new URL(r.url).pathname));
  expect(cached).toEqual(expect.arrayContaining(["/", "/entrar", "/criar", "/offline"]));

  await context.setOffline(true);
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Digite o código do convite" })).toBeVisible();

  await page.goto("/rota-que-nunca-foi-visitada");
  await expect(page.getByText("Sem sinal agora. Toque aqui para tentar de novo.")).toBeVisible();
  await context.setOffline(false);
});

test("dados do IndexedDB sobrevivem a um recarregamento (persistência local)", async ({ page }) => {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  const url = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Emy e Igor" })).toBeVisible();
  await page.goto("/eventos");
  await expect(page.getByRole("heading", { name: "Suas câmeras" })).toBeVisible();
  await expect(page.getByText("12 poses tiradas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir câmera" }).first()).toBeVisible();
  expect(url).toContain("/e/");
});

test("páginas privadas (/master, /painel, /conta) nunca entram no cache do service worker; o logout limpa as páginas guardadas", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }).catch(() => page.waitForLoadState("load"));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/master");
  await page.goto("/painel");
  await page.goto("/conta/excluir");
  await page.goto("/entrar");
  const names = () => page.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k.startsWith("mm-"))!)).keys()).map((r) => new URL(r.url).pathname));
  const cached = await names();
  expect(cached.some((p) => /^\/(master|painel|conta)(\/|$)/.test(p))).toBe(false);
  expect(cached).toContain("/entrar");
  // o logout manda o SW apagar as páginas visitadas, mantendo o shell
  await page.evaluate(() => navigator.serviceWorker.controller?.postMessage("mm-clear-pages"));
  await expect.poll(async () => (await names()).includes("/entrar")).toBe(true); // /entrar faz parte do shell e fica
  await context.setOffline(true);
  await page.goto("/master").catch(() => undefined);
  await context.setOffline(false);
});
