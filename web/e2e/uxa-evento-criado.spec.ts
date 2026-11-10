import { expect, test } from "@playwright/test";
import { createViaWizard, seedHost } from "./helpers";

test("UXA-101/102/103: Evento criado em 320 e 1440", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]); // a cópia só é confirmada quando de fato aconteceu (UX-12)
  for (const w of [320, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    const { id } = await createViaWizard(page, { title: "Casamento da Emy e do Igor na Chapada dos Guimarães" });
    await page.goto(`/criar/pronto/${id}`);
    const h1 = page.getByRole("heading", { level: 1, name: /A câmera de Casamento da Emy/ });
    await expect(h1).toBeVisible();
    const m = await page.evaluate(() => {
      const h = document.querySelector("h1")!;
      const share = [...document.querySelectorAll("button")].find((b) => /Compartilhar convite/.test(b.textContent ?? ""))!;
      return {
        lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        shareH: Math.round(share.getBoundingClientRect().height),
      };
    });
    expect(m.overflow).toBe(false);
    expect(m.lines).toBeLessThanOrEqual(6); // UXA-102: título (com "está pronta") sem palavra solta nem explosão de linhas
    expect(m.shareH).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: "Compartilhar convite" }).click();
    await expect(page.getByRole("button", { name: "Convite copiado" })).toBeVisible();
  }
});

test("UXA-110: o erro do campo some assim que o usuário corrige", async ({ page }) => {
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await page.getByRole("button", { name: "Próximo" }).click(); // 1 embalagem
  await page.getByRole("button", { name: "Próximo" }).click(); // 2 nome vazio: não avança
  await expect(page.getByText(/^Escolha o nome do evento\./)).toBeVisible();
  await page.getByLabel("Nome do evento").fill("Emy e Igor");
  await expect(page.getByText(/^Escolha o nome do evento\./)).toHaveCount(0);
});
