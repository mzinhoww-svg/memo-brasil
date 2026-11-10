import { expect, test } from "@playwright/test";
import { createViaWizard } from "./helpers";

test("UXA-101/102/103: Evento criado em 320 e 1440", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]); // a cópia só é confirmada quando de fato aconteceu (UX-12)
  for (const w of [320, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    const { id } = await createViaWizard(page, { title: "Casamento da Emy e do Igor na Chapada dos Guimarães" });
    await page.goto(`/criar/pronto/${id}`);
    await expect(page.getByTestId("link-convite")).toBeVisible();
    const m = await page.evaluate(() => ({
      colw: document.querySelector(".app-col")!.getBoundingClientRect().width,
      lines: Math.round(document.querySelector(".rv-event-nome")!.getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector(".rv-event-nome")!).lineHeight)),
      titleFont: getComputedStyle(document.querySelector(".rv-event-nome")!).fontSize,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      copyH: Math.round(document.querySelector(".pronto-url button")!.getBoundingClientRect().height),
    }));
    expect(m.overflow).toBe(false);
    expect(m.lines).toBeLessThanOrEqual(w === 320 ? 3 : 2); // UXA-102: título sem 4 linhas nem palavra solta
    expect(m.copyH).toBeGreaterThanOrEqual(44);
    if (w === 1440) expect(m.colw).toBeGreaterThan(900);
    await page.getByRole("button", { name: "Copiar link" }).click();
    await expect(page.getByText("Link copiado para a área de transferência.")).toBeVisible();
  }
});

test("UXA-110: o erro do campo some assim que o usuário corrige", async ({ page }) => {
  await page.goto("/criar");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Escolha o nome do evento. Todos os convidados vão ver.")).toBeVisible();
  await page.getByLabel("Nome do evento").fill("Emy e Igor");
  await expect(page.getByText("Escolha o nome do evento. Todos os convidados vão ver.")).toHaveCount(0);
});
