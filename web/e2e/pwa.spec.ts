import { expect, test } from "@playwright/test";

test("service worker assume o controle, guarda o shell e abre páginas visitadas sem rede", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // a partir daqui a página é controlada pelo SW
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entrar na festa" })).toBeVisible();

  const cached = await page.evaluate(async () => (await (await caches.open("mm-v1")).keys()).map((r) => new URL(r.url).pathname));
  expect(cached).toEqual(expect.arrayContaining(["/", "/entrar", "/criar", "/offline"]));

  await context.setOffline(true);
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entrar na festa" })).toBeVisible();

  await page.goto("/rota-que-nunca-foi-visitada");
  await expect(page.getByRole("heading", { name: "Sem sinal agora." })).toBeVisible();
  await context.setOffline(false);
});

test("dados do IndexedDB sobrevivem a um recarregamento (persistência local)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/agora/);
  const url = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();
  await expect(page.getByText("12 fotos")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seus eventos" })).toBeVisible();
  expect(url).toContain("/e/");
});
