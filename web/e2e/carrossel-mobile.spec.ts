import { expect, test, type Page } from "@playwright/test";
import { createViaWizard } from "./helpers";

// Carrossel de modelos do QR (25) e seletor de planos no celular (390x844): rolagem nativa, alvos de 44 px, sem rolagem horizontal da página.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const noPageHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("QR das mesas: deslizar o trilho troca o modelo e o texto do cartão", async ({ page }) => {
  const { id } = await createViaWizard(page, { reveal: "desligada", title: "Carrossel", shots: "10" });
  await page.goto(`/painel/${id}/qr`);
  await expect(page.getByText("Modelo 2 de 4").first()).toBeVisible();
  const track = page.locator(".cx-track");
  const textBefore = await page.locator(".cx-slide .tc-copy").nth(1).innerText();

  // desliza para o modelo 3 (rolagem nativa; o encaixe termina centrado)
  await track.evaluate((t) => { t.scrollTo({ left: t.scrollLeft + t.clientWidth, behavior: "instant" as ScrollBehavior }); });
  await expect(page.locator(".rv-caption", { hasText: /^Modelo \d de 4$/ })).toHaveText("Modelo 3 de 4");
  await expect(page.getByRole("button", { name: "Modelo 3 de 4" })).toHaveAttribute("aria-current", "true");
  const textAfter = await page.locator(".cx-slide .tc-copy").nth(2).innerText();
  expect(textAfter).not.toBe(textBefore);
  await expect(page.locator(".cx-slide .tc-copy").nth(2)).toBeInViewport();

  // as setas levam ao vizinho e a bolinha leva ao modelo pedido
  await page.getByRole("button", { name: "Próximo" }).click();
  await expect(page.locator(".rv-caption", { hasText: /^Modelo \d de 4$/ })).toHaveText("Modelo 4 de 4");
  await expect(page.getByRole("button", { name: "Próximo" })).toBeDisabled();
  await page.getByRole("button", { name: "Modelo 1 de 4" }).click();
  await expect(page.locator(".rv-caption", { hasText: /^Modelo \d de 4$/ })).toHaveText("Modelo 1 de 4");
  await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();

  expect(await noPageHScroll(page)).toBe(true);
});

test("QR das mesas: bolinhas e setas têm alvo de 44 px; o botão de proporção diz o estado", async ({ page }) => {
  const { id } = await createViaWizard(page, { reveal: "desligada", title: "Alvos" });
  await page.goto(`/painel/${id}/qr`);
  for (const name of ["Modelo 1 de 4", "Modelo 2 de 4", "Modelo 3 de 4", "Modelo 4 de 4", "Anterior", "Próximo"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
  const ratio = page.getByRole("button", { name: /^Proporção/ });
  await expect(ratio).toContainText("Retrato");
  await ratio.click();
  await expect(ratio).toContainText("Quadrado");
  expect(await noPageHScroll(page)).toBe(true);
});

test("QR das mesas: cartão sem corte nas bordas", async ({ page }) => {
  const { id } = await createViaWizard(page, { reveal: "desligada", title: "Sem corte" });
  await page.goto(`/painel/${id}/qr`);
  const card = page.locator(".cx-slide .tablecard").nth(1);
  await expect(card).toBeInViewport({ ratio: 1 });
  const box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(390 - 8);
});

test("Plano: o trilho rola por gesto sem selecionar; o toque seleciona", async ({ page }) => {
  const { id } = await createViaWizard(page, { reveal: "desligada", title: "Planos" });
  await page.goto(`/painel/${id}/plano`);
  const group = page.getByRole("radiogroup", { name: "Plano do evento" });
  if (!(await group.isVisible().catch(() => false))) test.skip(true, "ramo do checkout sem o seletor Revela");
  const checked = () => page.getByRole("radio", { checked: true }).getAttribute("aria-label");
  const before = await checked();
  const track = page.locator(".cx--plans .cx-track");
  const scrollable = await track.evaluate((t) => t.scrollWidth > t.clientWidth);
  if (scrollable) {
    await track.evaluate((t) => { t.scrollTo({ left: t.scrollWidth, behavior: "instant" as ScrollBehavior }); });
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
  }
  expect(await checked()).toBe(before);
  const last = page.getByRole("radio").last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toHaveAttribute("aria-checked", "true");
  expect(await noPageHScroll(page)).toBe(true);
});
