import { expect, test } from "@playwright/test";
import { createViaWizard } from "./helpers";

/** "QR para as mesas" no quadro do painel: o cartão do modelo ativo não sobe por baixo do cabeçalho nem cobre a linha "Modelo N de 4", e o seletor de modelo aparece. */
const SIZES: [number, number][] = [[390, 844], [360, 640], [768, 1024], [1024, 768], [1280, 800], [800, 1280]];
test("QR para as mesas: cartão abaixo do título, seletor visível e botão de baixar livre, em celular e tablet", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Teste Emy e Igor" });
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/painel/${id}/qr`);
    const caption = page.locator(".rv-caption[aria-live]").first();
    await expect(caption).toBeVisible();
    await page.waitForTimeout(700);
    const box = async (loc: ReturnType<typeof page.locator>) => (await loc.first().boundingBox())!;
    const cap = await box(caption);
    const card = await box(page.locator(".cx-slide", { hasText: /Teste Emy/ }).locator(".tablecard").nth(1)); // modelo 2: o ativo
    const dots = await box(page.locator(".cx-dots"));
    const head = await box(page.locator(".pf-top"));
    const foot = await box(page.locator(".pf-foot"));
    const where = `${w}x${h}`;
    expect(card.y, `${where}: o cartão começa abaixo da linha do título`).toBeGreaterThanOrEqual(cap.y + cap.height);
    expect(card.y, `${where}: o cartão não fica sob o cabeçalho`).toBeGreaterThanOrEqual(head.y + head.height);
    expect(dots.y, `${where}: o seletor fica abaixo do cartão`).toBeGreaterThanOrEqual(card.y + card.height - 1);
    expect(dots.y + dots.height, `${where}: o seletor aparece acima do botão de baixar`).toBeLessThanOrEqual(foot.y + 1);
    expect(card.x, `${where}: o cartão ativo cabe na largura`).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(w + 0.5);
    await expect(page.getByRole("button", { name: "Ver o modelo 3" }).or(page.locator(".cx-dot").nth(2))).toBeVisible();
  }
});
