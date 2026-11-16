import { test, expect } from "@playwright/test";

/** Feed revelado: dá para trocar para a grade de 3 colunas (como o perfil do Instagram), abrir uma foto e a escolha fica lembrada. */
test("feed: alterna para a grade de 3 colunas, abre a foto e lembra depois de recarregar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await expect(page.locator("article.post").first()).toBeVisible();

  await page.getByRole("button", { name: "Ver em grade" }).click();
  const grade = page.getByTestId("feed-grade");
  await expect(grade).toBeVisible();
  await expect(page.locator("article.post")).toHaveCount(0);
  const itens = grade.locator(".feed-grid__item");
  expect(await itens.count()).toBeGreaterThanOrEqual(3);
  const [a, b, c, d] = await Promise.all([0, 1, 2, 3].map(async (i) => (await itens.nth(i).boundingBox())!));
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);          // 3 lado a lado
  expect(Math.abs(b.y - c.y)).toBeLessThan(1);
  expect(d.y).toBeGreaterThan(a.y + a.height - 1);       // a quarta desce para a próxima linha
  expect(Math.abs(a.width - a.height)).toBeLessThan(1.5); // quadradas
  expect(c.x + c.width).toBeLessThanOrEqual(390.5);

  await itens.first().click();
  await expect(page.getByRole("dialog", { name: "Foto aberta" }).or(page.getByLabel("Foto aberta"))).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(page.getByTestId("feed-grade")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver em grade" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Ver em lista" }).click();
  await expect(page.locator("article.post").first()).toBeVisible();
  await page.reload();
  await expect(page.locator("article.post").first()).toBeVisible();
});
