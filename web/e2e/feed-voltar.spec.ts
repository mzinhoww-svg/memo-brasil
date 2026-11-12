import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/**
 * Voltar da Retrospectiva (itens 8 e 9 do backlog): volta pelo histórico com o Feed na mesma posição e com a mesma
 * paginação; link direto cai no Feed sem sair do app; anfitrião volta ao painel pela aba. O fim do evento é simulado
 * com o relógio de teste (`?agora=`, guardado na sessão), como em flows.spec.ts.
 */
const HOURS = 3_600_000;
const SAFE = ".scr .safe";

/** Evento de exemplo (12 fotos, revelação desligada) com o anfitrião Emy, direto no Feed. */
async function seedDemo(page: Page): Promise<string> {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/[A-Z0-9]{8}\/agora/);
  return page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
}

const savedTop = (page: Page, code: string) =>
  page.evaluate((c) => {
    try { return (JSON.parse(window.sessionStorage.getItem(`rv:feed:${c}`) ?? "null") as { top: number } | null)?.top ?? -1; } catch { return -1; }
  }, code);

/** O link "Ver a retrospectiva" fica no topo da lista; o clique por script não rola o Feed antes de navegar. */
const openRetroKeepingScroll = (page: Page) => page.getByRole("link", { name: "Ver a retrospectiva" }).evaluate((el) => (el as HTMLElement).click());

for (const vp of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`${vp.width}×${vp.height}: voltar da Retrospectiva e das abas devolve o Feed à posição em que estava`, async ({ page }) => {
    await page.setViewportSize(vp);
    const code = await seedDemo(page);
    await page.goto(`/e/${code}/agora?agora=${Date.now() + 9 * HOURS}`);
    const posts = page.locator("article.post");
    await expect(posts).toHaveCount(12);

    const safe = page.locator(SAFE);
    const target = await safe.evaluate((el) => { el.scrollTop = Math.min(1900, el.scrollHeight - el.clientHeight - 200); return el.scrollTop; });
    expect(target).toBeGreaterThan(800);
    await expect.poll(() => savedTop(page, code)).toBeGreaterThan(target - 5);

    // Feed → Retrospectiva → seta de voltar
    await openRetroKeepingScroll(page);
    await expect(page).toHaveURL(/\/retrospectiva/);
    await page.getByRole("link", { name: "Voltar" }).click();
    await expect(page).toHaveURL(new RegExp(`/e/${code}/agora`));
    await expect(posts).toHaveCount(12);
    await expect.poll(() => safe.evaluate((el) => el.scrollTop)).toBeGreaterThan(target - 40);
    expect(Math.abs((await safe.evaluate((el) => el.scrollTop)) - target)).toBeLessThanOrEqual(40);

    // Feed → Minhas → aba Feed
    await page.getByRole("link", { name: "Minhas", exact: true }).click();
    await expect(page).toHaveURL(/\/minhas/);
    await page.getByRole("link", { name: "Feed", exact: true }).click();
    await expect(page).toHaveURL(/\/agora/);
    await expect(posts).toHaveCount(12);
    await expect.poll(() => safe.evaluate((el, t) => Math.abs(el.scrollTop - t), target)).toBeLessThanOrEqual(40);

    // Feed → Você → aba Feed
    await page.getByRole("link", { name: "Você", exact: true }).click();
    await expect(page).toHaveURL(/\/voce/);
    await page.getByRole("link", { name: "Feed", exact: true }).click();
    await expect.poll(() => safe.evaluate((el, t) => Math.abs(el.scrollTop - t), target)).toBeLessThanOrEqual(40);

    // autores (stories) rolam na horizontal sem barra visível
    const stories = page.locator(".stories");
    expect(await stories.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("430×932: a paginação do Feed (mais de 20 fotos) volta igual depois da Retrospectiva", async ({ page }) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 430, height: 932 });
  const { code } = await createViaWizard(page, { title: "Feed voltar", reveal: "desligada" });
  // o Grátis dá 10 poses por pessoa: 3 pessoas × 10 fotos
  for (let i = 0; i < 10; i++) await postViaFile(page, code);
  for (const nome of ["Ana", "Beto"]) {
    await switchPerson(page, code, nome);
    for (let i = 0; i < 10; i++) await postViaFile(page, code);
  }
  await page.goto(`/e/${code}/agora?agora=${Date.now() + 7 * HOURS}`);
  const posts = page.locator("article.post");
  await expect(posts).toHaveCount(20);
  const safe = page.locator(SAFE);
  // rola até o fim: a sentinela pede a segunda página
  await safe.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(posts).toHaveCount(30);
  const target = await safe.evaluate((el) => { el.scrollTop = el.scrollHeight - el.clientHeight - 300; return el.scrollTop; });
  await expect.poll(() => savedTop(page, code)).toBeGreaterThan(target - 5);

  await openRetroKeepingScroll(page);
  await expect(page).toHaveURL(/\/retrospectiva/);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/agora`));
  await expect(posts).toHaveCount(30); // o limite voltou, não reiniciou em 20
  await expect.poll(() => safe.evaluate((el, t) => Math.abs(el.scrollTop - t), target)).toBeLessThanOrEqual(40);
});

test("link direto para a Retrospectiva: voltar cai no Feed, dentro do app, sem router.back()", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const code = await seedDemo(page);
  const origin = new URL(page.url()).origin;
  await page.goto(`/e/${code}/retrospectiva?agora=${Date.now() + 9 * HOURS}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("em 12 fotos");
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/agora`));
  expect(page.url().startsWith(origin)).toBe(true);
  await expect(page.locator("article.post").first()).toBeVisible();
  // a entrada da Retrospectiva foi trocada: voltar mais uma vez não reabre a Retrospectiva
  await page.goBack();
  await expect(page).not.toHaveURL(/\/retrospectiva/);
});

test("anfitrião: Painel → Feed → Retrospectiva → voltar → Painel pela aba", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { code, id } = await createViaWizard(page, { title: "Ciclo do anfitrião", reveal: "desligada" });
  await postViaFile(page, code);
  await page.goto(`/painel/${id}`);
  await page.evaluate((t) => window.sessionStorage.setItem("mm-agora", String(t)), Date.now() + 7 * HOURS);
  // navegação interna a partir do painel (sem recarregar o documento)
  await page.evaluate((u) => (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(u), `/e/${code}/agora`);
  await expect(page).toHaveURL(new RegExp(`/e/${code}/agora`));
  await expect(page.getByTestId("host-bar")).toBeVisible();

  await page.getByRole("link", { name: "Ver a retrospectiva" }).click();
  await expect(page).toHaveURL(/\/retrospectiva/);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/agora`));
  await page.getByRole("link", { name: "Painel do evento" }).click();
  await expect(page).toHaveURL(new RegExp(`/painel/${id}$`));
});
