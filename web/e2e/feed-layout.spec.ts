import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/** Feed fluido: o cartão ocupa a coluna em celulares estreitos e o fim da lista não fica atrás da barra de abas. */
for (const vp of [{ width: 430, height: 932 }, { width: 360, height: 740 }]) {
  test(`feed ${vp.width}×${vp.height}: cartão na coluna, sem rolagem lateral e fim da lista acima das abas`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { code } = await createViaWizard(page, { title: "Feed layout", reveal: "desligada" });
    await switchPerson(page, code, "Ana");
    for (let i = 0; i < 3; i++) await postViaFile(page, code);
    await page.goto(`/e/${code}/agora`);
    const posts = page.locator("article.post");
    await expect(posts).toHaveCount(3);

    const print = posts.first().locator(".rv-print");
    const box = await print.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - (vp.width - 40))).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const img = await posts.first().locator(".rv-print img").boundingBox();
    expect(img && box && img.width <= box.width && img.height <= box.height).toBe(true);

    const last = posts.last();
    await last.scrollIntoViewIfNeeded();
    await page.locator(".safe").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const tabs = await page.locator(".tabs").boundingBox();
    const end = await last.boundingBox();
    expect(tabs).not.toBeNull();
    expect((end?.y ?? 0) + (end?.height ?? 0)).toBeLessThanOrEqual((tabs?.y ?? 0) + 1);
  });
}
