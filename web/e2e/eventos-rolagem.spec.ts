import { test, expect } from "@playwright/test";
import { createViaWizard } from "./helpers";

/** "Suas câmeras" e "Você" do anfitrião: rolam até o fim por cima da barra de abas, e as linhas respondem ao toque. */
test("Suas câmeras rola até o fim e o rodapé não fica sob as abas", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 520 });
  await createViaWizard(page, { title: "Rolagem", reveal: "desligada" });
  await page.goto("/eventos");
  const safe = page.locator(".safe--scroll").first();
  await expect(safe).toBeVisible();
  await expect.poll(() => safe.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await safe.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => safe.evaluate((el) => Math.round(el.scrollTop))).toBeGreaterThan(50);
});

test("Você: linhas clicáveis de verdade, nome editável, sem linhas mortas", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 700 });
  await createViaWizard(page, { title: "Rolagem", reveal: "desligada" });
  await page.goto("/eventos/voce");
  await expect(page.getByText("Telefone")).toHaveCount(0);
  await expect(page.getByText("Ícone do app")).toHaveCount(0);
  const nome = page.getByRole("button", { name: /Nome e foto/ });
  await expect(nome).toBeVisible();
  expect(await nome.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
  expect((await nome.boundingBox())!.height).toBeGreaterThanOrEqual(55);
  await nome.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Seu nome").fill("Emy Nova");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Emy Nova" })).toBeVisible();
});
