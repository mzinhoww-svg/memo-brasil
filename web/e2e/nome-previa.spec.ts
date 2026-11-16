import { test, expect } from "@playwright/test";

/** Passo 2 do assistente: a prévia da embalagem mostra a imagem inteira (sem cortar a faixa do nome) e escreve o nome digitado. */
for (const [w, h] of [[820, 1180], [390, 844]] as const) {
  test(`passo 2 em ${w}×${h}: prévia inteira com o nome digitado`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/criar");
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /Próximo|Continuar/ }).click();
    await page.getByLabel("Nome do evento").fill("Festa de Aurimar");
    const box = page.locator(".namepreview");
    await expect(box.locator(".namepreview__band")).toHaveText("Festa de Aurimar");
    const b = (await box.boundingBox())!;
    expect(Math.abs(b.width / b.height - 1300 / 700)).toBeLessThan(0.05);
    const frame = (await page.locator(".sheet-full").boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    await box.screenshot({ path: `/tmp/claude-0/-home-user/60094700-d50a-5c2f-a498-d8e81e2e77fa/scratchpad/nome-${w}.png` });
  });
}
