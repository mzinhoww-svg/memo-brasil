import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

test.skip(!process.env.E2E_BASE_URL, "defina E2E_BASE_URL");

test("publicado: home, fontes, tema, manifest e service worker", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A festa vista por todo mundo." })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 20px "Bricolage Grotesque"'))).toBe(true);
  await page.getByRole("button", { name: "Mudar para o tema Noite" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "noite");
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("MemoriesMT");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBeGreaterThan(0);
});

test("publicado: criar evento, entrar como convidado, postar e reagir", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "Na hora, durante o evento", title: "Smoke publicado" });
  await expect(page.getByAltText(/QR Code do convite/)).toBeVisible();
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByText("Visão de Ana")).toBeVisible();
  await page.getByRole("button", { name: /^Amei/ }).click();
  await expect(page.getByRole("button", { name: /^Amei/ })).toHaveAttribute("aria-pressed", "true");
  expect(id).toBeTruthy();
});

test("publicado: painel e rota inexistente offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/agora/);
  await expect(page.getByText("12 fotos")).toBeVisible();
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/rota-nunca-visitada");
  await expect(page.getByRole("heading", { name: "Sem sinal agora." })).toBeVisible();
  await context.setOffline(false);
});
