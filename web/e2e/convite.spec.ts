import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, type RevealOpt } from "./helpers";

// Convite do painel (17k): prévia do convite e botão "Baixar QR code" (os downloads ficam em qr-download.spec.ts).

async function openStudio(page: Page, title: string, reveal: RevealOpt = "desligada") {
  const { id, code } = await createViaWizard(page, { title, reveal, shots: "10" });
  await page.goto(`/painel/${id}/convite`);
  await expect(page.locator(".a5-code b")).toHaveText(code);
  return { id, code };
}

test("revelação programada aparece por extenso no fuso do evento", async ({ page }) => {
  await openStudio(page, "Bodas", { date: "2030-11-23", time: "22:00", tz: "America/Cuiaba" });
  await expect(page.locator(".a5-f")).toContainText("As fotos aparecem para todos no sábado, 23 de novembro, às 22h.");
  await expect(page.locator(".a5-steps")).toContainText("10 poses suas");
});

test("nome muito longo não vaza da folha", async ({ page }) => {
  await openStudio(page, "Celebração dos cinquenta anos de casamento de Maria Aparecida e José Antônio");
  const box = (await page.locator(".a5").boundingBox())!;
  for (const t of await page.locator(".a5-t").all()) {
    const b = (await t.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(box.x);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  }
});

test("celular 360 px: Baixar QR code visível e sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openStudio(page, "Festa");
  const b = page.getByRole("button", { name: "Baixar QR code", exact: true });
  await b.scrollIntoViewIfNeeded();
  await expect(b).toBeVisible();
  expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: /Imprimir|Baixar PDF/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
