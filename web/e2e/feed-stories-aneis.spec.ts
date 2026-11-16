import { test, expect } from "@playwright/test";

/** A fileira de autores do feed não corta o anel dos círculos (box-shadow de 4px) nem em cima nem embaixo. */
for (const [w, h] of [[390, 844], [768, 1024]] as const) {
  test(`feed ${w}×${h}: o anel de cada autor cabe inteiro na fileira`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/dev/seed");
    await page.waitForURL(/agora/);
    const row = page.locator(".stories").first();
    await expect(row).toBeVisible();
    const rowBox = (await row.boundingBox())!;
    const avatars = row.locator(".story .avatar");
    expect(await avatars.count()).toBeGreaterThan(1);
    for (let i = 0; i < await avatars.count(); i++) {
      const b = (await avatars.nth(i).boundingBox())!;
      expect(b.y - 4).toBeGreaterThanOrEqual(rowBox.y - 0.5);
      expect(b.y + b.height + 4).toBeLessThanOrEqual(rowBox.y + rowBox.height + 0.5);
    }
  });
}
