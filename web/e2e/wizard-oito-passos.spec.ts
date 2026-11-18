import { test, expect, type Page } from "@playwright/test";
import { seedHost } from "./helpers";

/** Os 8 passos do assistente em 360×640 (o celular mais apertado): a ação principal é alcançável e nada passa da largura. */
test("assistente em 360×640: ação principal alcançável e sem rolagem lateral nos 7 passos", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/criar");
  await seedHost(page, "Emy");
  const problems: string[] = [];
  const check = async (passo: number) => {
    const cta = page.getByRole("button", { name: /Próximo|Continuar|Criar câmera/ }).first();
    await cta.waitFor();
    await cta.scrollIntoViewIfNeeded();
    const b = (await cta.boundingBox())!;
    if (b.y < 0 || b.y + b.height > 641) problems.push(`passo ${passo}: ação fora da tela (y=${Math.round(b.y)}, h=${Math.round(b.height)})`);
    if (b.x < 0 || b.x + b.width > 361) problems.push(`passo ${passo}: ação fora da largura`);
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) problems.push(`passo ${passo}: rolagem lateral`);
  };
  const next = async (passo: number) => { await check(passo); await page.getByRole("button", { name: "Próximo" }).click(); };
  await check(1); await page.getByRole("button", { name: "Próximo" }).click(); // 1 embalagem
  await page.getByLabel("Nome do evento").fill("Teste 360");
  await next(2);
  await next(3);
  await page.getByRole("button", { name: /Quando a festa acabar/ }).click();
  await next(4);
  await next(5);
  await next(6);
  await page.getByRole("heading", { level: 1, name: "Tudo pronto" }).waitFor();
  await check(7);
  expect(problems).toEqual([]);
});

/** Teclado aberto no passo 2: a área visível cai para ~340 px (o iOS não redimensiona a página). Campo e "Próximo" continuam alcançáveis rolando a folha. */
test("passo 2 com teclado aberto (360×340): campo e Próximo alcançáveis", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await page.getByRole("button", { name: "Próximo" }).click();
  const campo = page.getByLabel("Nome do evento");
  await campo.waitFor();
  await page.setViewportSize({ width: 360, height: 340 });
  await campo.focus();
  await campo.scrollIntoViewIfNeeded();
  const c = (await campo.boundingBox())!;
  expect(c.y).toBeGreaterThanOrEqual(0);
  expect(c.y + c.height).toBeLessThanOrEqual(341);
  const cta = page.getByRole("button", { name: "Próximo" });
  await cta.scrollIntoViewIfNeeded();
  const b = (await cta.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(341);
  // o corpo da página não rola: quem rola é a folha
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
});
