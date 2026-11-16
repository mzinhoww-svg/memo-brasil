import { test, expect, type Page } from "@playwright/test";

/** O dígito visível de cada coluna do odômetro é o do número (o contador "poses restantes" e o cronômetro da espera). */
async function visibleDigits(page: Page, scope: string) {
  return page.locator(`${scope} .rv-odo`).evaluateAll((odos) => odos.map((odo) => {
    const label = odo.getAttribute("aria-label") ?? "";
    const cols = [...odo.children] as HTMLElement[];
    const got = cols.map((col) => {
      const w = col.getBoundingClientRect();
      const hit = ([...col.querySelectorAll("i")] as HTMLElement[]).find((i) => { const r = i.getBoundingClientRect(); const cy = r.top + r.height / 2; return cy > w.top && cy < w.bottom; });
      return { digit: hit?.textContent ?? "", width: w.width, height: w.height, font: parseFloat(getComputedStyle(col).fontSize) };
    });
    return { label, got };
  }));
}

for (const [w, h] of [[390, 844], [360, 640]] as const) {
  test(`espera do filme em ${w}×${h}: cada coluna mostra o dígito certo, inteiro e sem encolher`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/dev/revela/Convidado-fim");
    await expect(page.locator(".countdown .rv-odo").first()).toBeVisible();
    await page.waitForTimeout(900); // fim da rolagem
    for (const scope of [".rv-counter", ".countdown"]) {
      const odos = await visibleDigits(page, scope);
      expect(odos.length).toBeGreaterThan(0);
      for (const o of odos) {
        expect(o.got.map((g) => g.digit).join("")).toBe(o.label);
        for (const g of o.got) {
          expect(g.width).toBeGreaterThan(g.font * 0.45); // a coluna não encolhe até virar uma fatia
          expect(g.height).toBeGreaterThanOrEqual(g.font * 0.95);
        }
      }
    }
  });
}
