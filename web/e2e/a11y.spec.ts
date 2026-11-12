import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, seedHost, setTheme } from "./helpers";

for (const width of [390, 1280]) {
  test(`axe: 0 violações em /, /precos, /ajuda, /painel/[id] e /painel/[id]/configuracoes a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { id } = await createViaWizard(page, { title: "Axe" });
    const problems: string[] = [];
    for (const route of ["/", "/precos", "/ajuda", `/painel/${id}`, `/painel/${id}/configuracoes`]) {
      await page.goto(route);
      await page.locator("h1, h2, main").first().waitFor(); // o desenho Revela nem sempre abre em h1 (ex.: /ajuda usa título em texto)
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
  test(`axe: 0 violações nos 8 passos do assistente de criação a ${width}px`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/criar");
    await seedHost(page, "Emy");
    const problems: string[] = [];
    for (let passo = 1; passo <= 8; passo++) {
      await page.getByText(`${passo}/8`, { exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`passo ${passo} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      if (passo === 2) await page.getByLabel("Nome do evento").fill("Axe");
      if (passo === 4) await page.getByRole("button", { name: /Quando a festa acabar/ }).click();
      if (passo < 8) await page.getByRole("button", { name: "Próximo" }).click();
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

/** Evento de exemplo semeado (/dev/seed) e seu código. O feed Revela abre com o título do evento em h1, não mais com o título "Agora". */
async function openSeed(page: Page): Promise<string> {
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/[A-Z0-9]{8}\/agora/);
  await page.locator("main h1").first().waitFor();
  return page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
}

for (const theme of ["dia", "noite"] as const) {
  test(`acessibilidade (axe) sem violações graves, tema ${theme}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    const code = await openSeed(page);
    const id = await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
      const all: { id: string }[] = await new Promise((res) => { const r = db.transaction("events").objectStore("events").getAll(); r.onsuccess = () => res(r.result); });
      return all[0].id;
    });
    const routes = ["/", "/entrar", "/criar", "/exemplo", "/termos", `/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/postar`, `/painel/${id}`, `/painel/${id}/conteudo`, `/painel/${id}/convidados`, `/painel/${id}/momentos`, `/painel/${id}/qr`, `/painel/${id}/configuracoes`, `/painel/${id}/downloads`];
    const problems: string[] = [];
    for (const route of routes) {
      await page.goto(route);
      if (route.endsWith("/explorar")) await page.waitForURL((u) => !u.pathname.endsWith("/explorar")); // rota de redirecionamento: audita o destino
      await page.locator("h1, h2, main").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations.filter((v) => v.impact === "critical" || v.impact === "serious")) {
        problems.push(`${route} [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
