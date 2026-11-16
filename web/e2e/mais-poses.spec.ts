import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedHost } from "./helpers";

/**
 * Poses por plano e pacote "Mais poses".
 * - O ambiente local só tem o plano Grátis; os specs do assistente injetam um catálogo pago de exemplo por `window.__MM_DEV_CATALOG__`
 *   (só existe no build com NEXT_PUBLIC_MM_DEV_TOOLS=1). Nada é cobrado: os testes param antes de criar o evento.
 * - O painel usa a bancada `/dev/plano-painel` (`?atual=`), que mostra o texto que o botão mandaria pagar em [data-testid=pago].
 */
const NATIVO = process.env.NEXT_PUBLIC_VALIDAPAY_CHECKOUT === "1";
const plan = (code: string, name: string, maxGuests: number | null, maxShots: number | null, priceCents: number, isFree = false) => ({ code, name, maxGuests, maxShots, priceCents, isFree, features: [] as string[] });
const CATALOGO = {
  plans: [plan("gratis", "Grátis", 10, 10, 0, true), plan("festa", "Festa", 50, 24, 5990), plan("celebracao", "Celebração", 100, 24, 8900), plan("casamento", "Casamento", 250, 36, 18900), plan("grande", "Grande", 500, null, 34900)],
  packs: [
    { code: "festa_36", baseCode: "festa", name: "Festa + Mais poses", maxGuests: 50, maxShots: 36, baseMaxShots: 24, priceCents: 7980, extraCents: 1990, available: true },
    { code: "celebracao_36", baseCode: "celebracao", name: "Celebração + Mais poses", maxGuests: 100, maxShots: 36, baseMaxShots: 24, priceCents: 10890, extraCents: 1990, available: true },
  ],
};

/** Violações axe (WCAG 2.x A/AA) da tela atual. */
async function axe(page: Page): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

async function chegarEmPoses(page: Page, catalogo: unknown) {
  await page.addInitScript((c) => { (window as unknown as { __MM_DEV_CATALOG__: unknown }).__MM_DEV_CATALOG__ = c; }, catalogo);
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await next();
  await page.getByLabel("Nome do evento").fill("Festa da Ana");
  await next();
  await next();
  await next();
  await expect(page.getByRole("heading", { name: "Quantas poses?" })).toBeVisible();
  return next;
}

test("assistente: cada opção de poses mostra o custo do catálogo, sem a de 27, e avisa a troca de plano", async ({ page }) => {
  await chegarEmPoses(page, CATALOGO);
  const grupo = page.getByRole("group", { name: "Poses por pessoa" });
  await expect(grupo.getByRole("button")).toHaveCount(4);
  await expect(grupo.getByRole("button", { name: "10 · Grátis" })).toBeVisible();
  await expect(grupo.getByRole("button", { name: "24 · a partir de R$ 59,90" })).toBeVisible();
  await expect(grupo.getByRole("button", { name: "36 · a partir de R$ 189" })).toBeVisible();
  await expect(grupo.getByRole("button", { name: "Livre · a partir de R$ 349" })).toBeVisible();
  await expect(page.getByText(/exige/)).toHaveCount(0);
  await expect(page.getByTestId("aviso-plano-poses")).toHaveCount(0); // 10 poses = Grátis: nenhum aviso
  await grupo.getByRole("button", { name: /^24/ }).click();
  await expect(page.getByTestId("aviso-plano-poses")).toHaveText("Isso muda seu plano para Festa.");
  await grupo.getByRole("button", { name: /^36/ }).click();
  await expect(page.getByTestId("aviso-plano-poses")).toHaveText("Isso muda seu plano para Casamento.");
  expect(await axe(page)).toEqual([]); // aviso e legendas com custo
  await grupo.getByRole("button", { name: /^Livre/ }).click();
  await expect(page.locator(".rv-counter b")).toHaveText("Livre");
  await grupo.getByRole("button", { name: /^10/ }).click();
  await expect(page.getByTestId("aviso-plano-poses")).toHaveCount(0);
  // sem exceder a largura do celular
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("assistente: sem plano pago ativo as opções acima do Grátis dizem 'indisponível' (sem prometer troca de plano)", async ({ page }) => {
  await chegarEmPoses(page, undefined);
  await expect(page.getByRole("button", { name: "24 · indisponível" })).toBeVisible();
  await page.getByRole("button", { name: /^24/ }).click();
  await expect(page.getByTestId("aviso-plano-poses")).toHaveCount(0);
});

test("assistente, passo 8: interruptor Mais poses nos cartões Festa/Celebração soma ao total do botão", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); // tela baixa: a linha do interruptor não pode encolher a zero
  const next = await chegarEmPoses(page, CATALOGO);
  await page.getByRole("button", { name: /^24/ }).click();
  await next(); await next(); await next(); // filme, quem vê, plano
  await expect(page.getByRole("heading", { name: "Escolha o plano" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Festa/ })).toBeChecked();
  const interruptor = page.getByRole("switch", { name: "Mais poses +R$ 19,90" });
  await expect(interruptor).toHaveAttribute("aria-checked", "false");
  expect((await page.getByTestId("mais-poses-opcao").boundingBox())?.height ?? 0).toBeGreaterThan(40);
  await expect(page.getByTestId("mais-poses-opcao")).toContainText("+12 poses por pessoa (24 → 36)");
  await expect(page.getByRole("button", { name: "Continuar · R$ 59,90" })).toBeVisible();
  await interruptor.click();
  await expect(interruptor).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Continuar · R$ 79,80" })).toBeVisible();
  await expect(page.locator(".summary")).toContainText("36 por pessoa");
  expect(await axe(page)).toEqual([]);
  await interruptor.press("Space"); // teclado também alterna
  await expect(page.getByRole("button", { name: "Continuar · R$ 59,90" })).toBeVisible();
  // Casamento não tem pacote
  await page.getByRole("radio", { name: /^Casamento/ }).click();
  await expect(page.getByRole("switch", { name: /Mais poses/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /^Celebração/ }).click();
  await expect(page.getByRole("switch", { name: "Mais poses +R$ 19,90" })).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test.describe("painel · Plano: cartão Mais poses (bancada /dev/plano-painel)", () => {
  test.skip(!NATIVO, "O cartão é conferido no ramo nativo (build com NEXT_PUBLIC_VALIDAPAY_CHECKOUT=1).");

  test("Festa sem o pacote: cartão com R$ 19,90; adicionar paga o plano-variante", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dev/plano-painel?atual=festa");
    const cartao = page.getByTestId("cartao-mais-poses");
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("de 24 para 36 por pessoa");
    expect(await axe(page)).toEqual([]);
    await page.getByRole("button", { name: "Adicionar Mais poses · R$ 19,90" }).click();
    await expect(page.getByTestId("pago")).toHaveText("festa_36");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
  test("Celebração sem o pacote paga a variante da Celebração", async ({ page }) => {
    await page.goto("/dev/plano-painel?atual=celebracao");
    await page.getByRole("button", { name: "Adicionar Mais poses · R$ 19,90" }).click();
    await expect(page.getByTestId("pago")).toHaveText("celebracao_36");
  });
  test("quem já tem o pacote vê Festa + Mais poses e nenhum cartão; Grátis e pacotes desligados também não", async ({ page }) => {
    await page.goto("/dev/plano-painel?atual=festa_36");
    await expect(page.getByText("Festa + Mais poses · R$ 48,90")).toBeVisible();
    await expect(page.getByTestId("cartao-mais-poses")).toHaveCount(0);
    await page.goto("/dev/plano-painel");
    await expect(page.getByTestId("cartao-mais-poses")).toHaveCount(0);
    await page.goto("/dev/plano-painel?atual=festa&pacotes=0");
    await expect(page.getByRole("button", { name: /^Escolher para|^Trocar para/ })).toBeVisible();
    await expect(page.getByTestId("cartao-mais-poses")).toHaveCount(0);
  });
});

test("plano pago: continuar vai direto ao checkout, sem popup e sem parar no painel", async ({ page }) => {
  test.skip(!NATIVO, "o destino direto ao checkout nativo só existe no build com NEXT_PUBLIC_VALIDAPAY_CHECKOUT=1");
  const next = await chegarEmPoses(page, CATALOGO);
  await page.getByRole("group", { name: "Poses por pessoa" }).getByRole("button", { name: /^24/ }).click();
  await next(); // filme
  await next(); // quem vê
  await next(); // plano
  const continuar = page.getByRole("button", { name: /^Continuar · R\$ 59,90$/ });
  await expect(continuar).toBeVisible();
  await expect(page.getByTestId("aviso-aceite")).toContainText("Ao continuar, você aceita os Termos de Uso");
  await continuar.click();
  await expect(page.getByRole("dialog", { name: "Antes de criar" })).toHaveCount(0);
  await page.waitForURL(/\/painel\/[^/]+\/checkout-validapay\?plano=festa$/);
});
