import { test, expect } from "@playwright/test";

/** Passo 1 e passo 3 do assistente no celular: a câmera não é cortada pelas bordas e a linha de data/hora recebe o toque no campo nativo. */
for (const [w, h] of [[390, 844], [360, 640]] as const) {
  test(`assistente em ${w}×${h}: câmera inteira e data tocável`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/criar");
    const cam = page.getByTestId("cam3d");
    await expect(cam).toBeVisible();
    await page.waitForTimeout(1200); // entrada da câmera
    const body = (await page.locator(".sheet-body").first().boundingBox())!;
    // a caixa de recorte da folha vai de borda a borda (a câmera sangra 20px de cada lado)
    expect(body.x).toBeLessThanOrEqual(0.5);
    expect(body.width).toBeGreaterThanOrEqual(w - 0.5);
    const img = (await cam.locator("img").boundingBox())!;
    expect(img.x).toBeGreaterThanOrEqual(body.x - 2);
    expect(img.x + img.width).toBeLessThanOrEqual(body.x + body.width + 2);

    await page.getByRole("button", { name: /Próximo|Continuar/ }).click();
    await page.getByLabel("Nome do evento").fill("Teste");
    await page.getByRole("button", { name: /Próximo|Continuar/ }).click();
    for (const i of [0, 1, 2]) {
      const row = (await page.locator(".rv-row").nth(i).boundingBox())!;
      const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y) as HTMLInputElement | null; return `${e?.tagName}:${e?.type}`; }, [row.x + row.width / 2, row.y + row.height / 2]);
      expect(hit).toBe(i === 0 ? "INPUT:date" : "INPUT:time");
    }
  });
}
