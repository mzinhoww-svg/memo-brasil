import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createViaWizard } from "./helpers";

test("local checkout stays closed without configuration, survives reload and does not call a payment provider", async ({ page }, info) => {
  const financialRequests: string[] = [];
  page.on("request", (request) => { if (/validapay\.com\.br/.test(request.url())) financialRequests.push(request.url()); });
  const { id } = await createViaWizard(page, { title: "ValidaPay local validation" });
  await page.goto(`/painel/${id}/checkout-validapay?plano=festa`);
  await expect(page.getByRole("heading", { name: "Checkout indisponível" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Gerar Pix|Confirmar pagamento/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Checkout indisponível" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(financialRequests).toEqual([]);
  const axe = await new AxeBuilder({ page }).include("main").analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("validapay-disabled.png"), fullPage: true });
});
