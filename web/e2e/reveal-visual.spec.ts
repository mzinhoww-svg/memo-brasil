import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, postViaFile, setTheme, switchPerson } from "./helpers";

const SHOTS = path.resolve(__dirname, "../../docs/qa/screenshots");
const MIN = 60_000;
const at = (t0: number, m: number) => { const d = new Date(t0 + m * MIN); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" }; };

async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  if (process.env.SAVE_SHOTS) await page.screenshot({ path: path.join(SHOTS, `revelacao-${name}.png`), fullPage, animations: "disabled" });
}
async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${label} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, bad.join("\n")).toEqual([]);
}

for (const vp of [{ n: "390", w: 390, h: 844 }, { n: "1440", w: 1440, h: 900 }]) {
  for (const theme of ["dia", "noite"] as const) {
    test(`revelação: configuração, espera, transição e galeria em ${vp.n}px, tema ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setTheme(page, theme);
      const key = `${vp.n}-${theme}`;
      const t0 = Date.now();
      await page.clock.install({ time: t0 });
      const { code, id } = await createViaWizard(page, { title: "Emy e Igor", reveal: at(t0, 3) });

      // organizador: configuração
      await page.goto(`/painel/${id}/configuracoes`);
      await page.getByRole("button", { name: /^Revela\b/ }).click();
      await expect(page.getByTestId("config-revelacao")).toBeVisible();
      await page.getByTestId("config-revelacao").scrollIntoViewIfNeeded();
      await shot(page, `${key}-config`);
      await axe(page, `config ${key}`);

      // convidado: espera
      await switchPerson(page, code, "Ana");
      await postViaFile(page, code);
      await page.goto(`/e/${code}/agora`);
      await expect(page.getByText("NO LABORATÓRIO")).toBeVisible();
      await shot(page, `${key}-espera`);
      await axe(page, `espera ${key}`);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(o.sw).toBeLessThanOrEqual(o.iw);

      // revelação
      await page.clock.fastForward("04:00");
      await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Revelou." })).toBeVisible({ timeout: 6000 });
      await shot(page, `${key}-transicao`);
      await axe(page, `transição ${key}`);
      await page.getByRole("button", { name: "Abrir o feed" }).click();
      await expect(page.locator("article.post")).toHaveCount(1);
      await page.waitForTimeout(0);
      await shot(page, `${key}-galeria`);
    });
  }
}

test("modo sem revelação em 390px, temas dia e noite", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dia", "noite"] as const) {
    await setTheme(page, theme);
    const { code } = await createViaWizard(page, { title: `Sem revelação ${theme}`, reveal: "desligada" });
    await switchPerson(page, code, "Ana");
    await postViaFile(page, code);
    await page.goto(`/e/${code}/agora`);
    await expect(page.locator("article.post b", { hasText: /^Ana$/ }).first()).toBeVisible();
    await shot(page, `390-${theme}-sem-revelacao`);
    await axe(page, `sem revelação ${theme}`);
  }
});
