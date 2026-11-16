import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createViaWizard, enterAsGuest, openInviteAsGuest } from "./helpers";

/** Revela 2.0: sem rolagem lateral e sem violações do Axe (WCAG 2.1 AA) em 360, 390 e 430 px nas telas ligadas. */
for (const width of [360, 390, 430]) {
  test(`Revela: sem rolagem lateral e Axe limpo a ${width}px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 844 });
    const { id, code } = await createViaWizard(page, { title: "Revela Axe", reveal: "desligada" });
    await openInviteAsGuest(page, code);
    await enterAsGuest(page, "Ana");
    const routes = ["/", "/entrar", "/precos", "/ajuda", "/termos", "/eventos", "/eventos/voce", `/e/${code}/agora`, `/e/${code}/minhas`, `/e/${code}/voce`, `/e/${code}/programacao`,
      `/painel/${id}`, `/painel/${id}/configuracoes`, `/painel/${id}/convidados`, `/painel/${id}/qr`, `/painel/${id}/downloads`, `/painel/${id}/convites`];
    const problems: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      await page.locator("h1, h2").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${route}: rolagem lateral de ${overflow}px`);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`${route} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
