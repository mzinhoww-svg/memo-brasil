import { test, expect } from "@playwright/test";

/** "Minhas poses" com o rolo cheio rola por dentro, e o botão "Enviar do rolo da câmera" fica acima da barra de abas no fim. */
test("Minhas poses: rola até o fim e o botão do rolo fica livre da barra de abas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/dev/revela/Convidado-minhas");
  const area = page.locator(".safe--scroll");
  await expect(area).toBeVisible();
  await area.evaluate((e) => { e.scrollTop = e.scrollHeight; });
  const btn = (await page.getByRole("button", { name: "Enviar do rolo da câmera" }).boundingBox())!;
  const tabs = (await page.locator(".tabs").boundingBox())!;
  expect(btn.y + btn.height).toBeLessThanOrEqual(tabs.y + 1);
});
