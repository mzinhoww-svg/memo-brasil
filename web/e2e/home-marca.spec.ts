import { expect, test } from "@playwright/test";

/** Abertura: a marca é legível (símbolo e nome maiores) e o cabeçalho cabe sem rolagem lateral em telas estreitas. */
for (const width of [320, 360, 390, 430]) {
  test(`abertura em ${width}px: marca visível e cabeçalho sem estourar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const brand = page.getByRole("link", { name: "Revela, início" });
    await expect(brand).toBeVisible();
    const box = (await brand.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(box.width).toBeGreaterThanOrEqual(130);
    const invite = page.getByRole("link", { name: /Tenho um convite/ });
    await expect(invite).toBeVisible();
    const ib = (await invite.boundingBox())!;
    expect(ib.x + ib.width, "convite dentro da tela").toBeLessThanOrEqual(width);
    expect(box.x + box.width, "marca não passa por cima do convite").toBeLessThanOrEqual(ib.x + 1);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(1);
  });
}
