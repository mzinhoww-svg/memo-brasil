import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createViaWizard, openDemo, setTheme } from "./helpers";

for (const width of [390, 1280]) {
  test(`axe: 0 violações em /, /ajuda e /painel/[id] a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { id } = await createViaWizard(page, { title: "Axe" });
    const problems: string[] = [];
    for (const route of ["/", "/ajuda", `/painel/${id}`]) {
      await page.goto(route);
      await page.locator("h1").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`${route} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

for (const width of [390, 1280]) {
  test(`axe: 0 violações em /painel/[id]/plano (B7) a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { id } = await createViaWizard(page, { title: "Axe plano" });
    await page.goto(`/painel/${id}/plano`);
    await page.getByRole("heading", { level: 1, name: "De que tamanho é a festa?" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const problems = r.violations.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

for (const width of [390, 1280]) {
  test(`axe: 0 violações nos 4 passos do assistente de criação a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/criar");
    const problems: string[] = [];
    for (let passo = 1; passo <= 4; passo++) {
      await page.getByText(`Passo ${passo} de 4`).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`passo ${passo} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      if (passo === 1) await page.getByLabel("Nome que os convidados vão ver").fill("Axe");
      if (passo === 3) await page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: /^36/ }).click();
      if (passo < 4) await page.getByRole("button", { name: "Continuar" }).click();
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

for (const theme of ["dia", "noite"] as const) {
  test(`acessibilidade (axe) sem violações graves, tema ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    const code = await openDemo(page);
    const id = await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
      const all: { id: string }[] = await new Promise((res) => { const r = db.transaction("events").objectStore("events").getAll(); r.onsuccess = () => res(r.result); });
      return all[0].id;
    });
    const routes = ["/", "/entrar", "/criar", "/design", `/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/postar`, `/painel/${id}`, `/painel/${id}/conteudo`, `/painel/${id}/convidados`, `/painel/${id}/momentos`, `/painel/${id}/qr`, `/painel/${id}/configuracoes`, `/painel/${id}/downloads`];
    const problems: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      await page.locator("h1").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations.filter((v) => v.impact === "critical" || v.impact === "serious")) {
        problems.push(`${route} [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
