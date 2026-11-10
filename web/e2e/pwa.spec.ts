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
