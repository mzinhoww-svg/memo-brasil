import { expect, test } from "@playwright/test";

test("home abre com a marca, o CTA e a assinatura", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A festa vista por todo mundo." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar na festa" })).toBeVisible();
  await expect(page.getByText("MemoriesMT").first()).toBeVisible();
  await expect(page).toHaveTitle(/MemoriesMT/);
});

test("manifest e ícones do PWA respondem", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBe(true);
  const json = await m.json();
  expect(json.name).toBe("MemoriesMT");
  expect(json.display).toBe("standalone");
  for (const icon of json.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
