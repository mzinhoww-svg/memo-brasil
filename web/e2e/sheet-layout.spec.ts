import { test, expect, type Page } from "@playwright/test";
import { createViaWizard } from "./helpers";

/** Folhas (Sheet) em três tamanhos: cabem na tela, mostram título e ações, fecham por Esc e pelo toque fora; sem rolagem lateral. */
const SIZES = [[360, 640], [390, 844], [768, 1024]] as const;

async function expectInside(page: Page, sel: string, w: number, h: number) {
  // a folha entra deslizando: espera assentar antes de medir
  await expect.poll(async () => { const b = await page.locator(sel).first().boundingBox(); return b ? Math.round(b.y + b.height) : -1; }, { timeout: 5000 }).toBeLessThanOrEqual(h + 1);
  const b = (await page.locator(sel).first().boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(-1);
  expect(b.y).toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
}

for (const [w, h] of SIZES) {
  test(`folha "Novo momento" em ${w}×${h}: dentro da tela, ação visível, Esc e toque fora fecham`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    const { id } = await createViaWizard(page, { title: `Folha ${w}`, reveal: "desligada" });
    await page.goto(`/painel/${id}/momentos`);
    const dialog = page.getByRole("dialog");
    const openSheet = () => page.getByRole("button", { name: /Adicionar/ }).first().click();
    await openSheet();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2 })).toBeVisible();
    await expectInside(page, '[role="dialog"]', w, h);
    const ok = dialog.getByRole("button", { name: "Pronto" });
    await ok.scrollIntoViewIfNeeded();
    await expect.poll(async () => { const b = (await ok.boundingBox())!; return Math.round(b.y + b.height); }).toBeLessThanOrEqual(h + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (w >= 768) { // tablet: cartão centrado, não colado embaixo
      await expect.poll(async () => { const p = (await dialog.boundingBox())!; return Math.round(p.y + p.height); }).toBeLessThan(h - 8);
      const p = (await dialog.boundingBox())!;
      expect(Math.abs(p.x + p.width / 2 - w / 2)).toBeLessThan(2);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // toque fora fecha
    await openSheet();
    await expect(dialog).toBeVisible();
    await expectInside(page, '[role="dialog"]', w, h); // espera a entrada terminar
    await page.mouse.click(w / 2, 4);
    await expect(dialog).toBeHidden();
  });
}
