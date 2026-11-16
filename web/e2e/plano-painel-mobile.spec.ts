import { expect, test, type Page } from "@playwright/test";

/**
 * Plano no quadro do painel (celular). Sem Supabase: a bancada `/dev/plano-painel` (só no build com DEV_TOOLS) monta o PlanPicker dentro do
 * PainelFrame com planos de exemplo. Rode o build duas vezes: COM `NEXT_PUBLIC_VALIDAPAY_CHECKOUT=1` (ramo nativo, o de produção) e SEM
 * a flag (ramo Mercado Pago); o spec lê a mesma variável para saber qual botão esperar.
 * EMULAÇÃO de viewport no Chromium: não substitui aparelho físico (iOS Safari: barra dinâmica, teclado).
 */
const NATIVO = process.env.NEXT_PUBLIC_VALIDAPAY_CHECKOUT === "1";
const BOTAO = NATIVO ? /^Escolher para Casamento · R\$ 189$/ : /^Pagar com Mercado Pago · R\$\s189,00$/;
const TAMANHOS = [
  { nome: "390×844", width: 390, height: 844 },
  { nome: "360×640", width: 360, height: 640 },
  { nome: "tela baixa 390×568", width: 390, height: 568 },
  { nome: "tela baixa 360×568", width: 360, height: 568 },
];

async function abrir(page: Page, vp: { width: number; height: number }, query = "") {
  await page.setViewportSize(vp);
  await page.goto(`/dev/plano-painel${query}`);
  const botao = page.locator(".pf-foot").getByRole("button", { name: BOTAO });
  await expect(botao).toBeVisible();
  return botao;
}

for (const vp of TAMANHOS) {
  test(`plano no quadro em ${vp.nome}: Confirmar visível sem rolar, sem rolagem lateral, h1 único e abas`, async ({ page }) => {
    const botao = await abrir(page, vp);
    // sem rolar nada: o botão está inteiro na tela
    await expect(botao).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    // quadro: um h1 ("Plano"), abas presentes com Plano atual, sem migalhas nem menu lateral
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plano");
    await expect(page.getByRole("navigation", { name: "Seções do painel" })).toBeVisible();
    await expect(page.locator('.pf-tabs [aria-current="page"]')).toHaveText("Plano");
    await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toHaveCount(0);
    await expect(page.locator(".scr")).toHaveCount(0);
    // alvos de toque de 44 px (botão e abas)
    const alturas = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".pf-foot .rv-btn, .pf-tab, .pf-head .rv-icon-btn")].map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(alturas.length).toBeGreaterThan(3);
    for (const h of alturas) expect(h).toBeGreaterThanOrEqual(44);
    // o corpo reserva a altura do rodapé: rolando até o fim, o último item termina acima dele e o botão segue à vista
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const fim = await page.evaluate(() => {
      const foot = document.querySelector(".pf-foot")!.getBoundingClientRect();
      const kids = [...document.querySelectorAll<HTMLElement>(".pf-body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
      const last = Math.max(...kids.map((e) => e.getBoundingClientRect().bottom));
      return { last, footTop: foot.top, footBottom: foot.bottom, vh: window.innerHeight };
    });
    expect(fim.last).toBeLessThanOrEqual(fim.footTop + 1);
    expect(fim.footBottom).toBeLessThanOrEqual(fim.vh + 1);
    await expect(botao).toBeInViewport({ ratio: 1 });
  });

  test(`plano no quadro em ${vp.nome}: erro longo fica no fluxo e o Confirmar continua visível sem rolar`, async ({ page }) => {
    const botao = await abrir(page, vp, "?erro=longo");
    await expect(botao).toBeInViewport({ ratio: 1 });
    const erro = page.locator(".pf-body").getByRole("alert");
    await expect(erro).toContainText("Não foi possível abrir o pagamento agora");
    await expect(page.locator(".pf-foot").getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    // o texto de erro, rolado até ele, fica inteiro acima do rodapé
    await erro.scrollIntoViewIfNeeded();
    const caixa = await erro.boundingBox();
    const rodape = await page.locator(".pf-foot").boundingBox();
    expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(rodape!.y + 1);
    await expect(botao).toBeInViewport({ ratio: 1 });
  });
}

test("plano no quadro: nota de pagamento no fluxo (não no rodapé) e carrossel de planos com rolagem nativa", async ({ page }) => {
  await abrir(page, { width: 390, height: 844 });
  const rodape = page.locator(".pf-foot");
  await expect(rodape.getByRole("button")).toHaveCount(1);
  if (NATIVO) {
    await expect(page.locator(".pf-body").getByText("Pix ou cartão, sem sair do app")).toBeVisible();
    await expect(rodape.getByText("Pix ou cartão, sem sair do app")).toHaveCount(0);
    const trilha = page.locator(".cx-track").first();
    expect(await trilha.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    await expect(page.getByRole("radiogroup", { name: "Plano do evento" })).toBeVisible();
    // tocar em outro cartão troca o rótulo do botão
    await page.getByRole("radio", { name: /^Celebração/ }).click();
    await expect(rodape.getByRole("button", { name: /^Escolher para Celebração · R\$ 89$/ })).toBeVisible();
  } else {
    await expect(page.getByTestId("resumo-pedido")).toContainText("Pagamento único");
    await expect(page.locator(".pf-body").getByText(/Você conclui o pagamento no Mercado Pago/)).toBeVisible();
    await expect(page.locator(".plano-pagar")).toHaveCount(0);
  }
  // a seta do quadro leva à rota pai, sem usar o histórico
  await page.getByRole("button", { name: "Voltar" }).click();
  await page.waitForURL(/\/dev\/plano-painel$/);
  await expect(page.locator(".pf-foot").getByRole("button")).toBeVisible();
});

test("plano no quadro: ocupado deixa o botão desabilitado com rótulo de carregamento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/plano-painel?ocupado=1");
  const botao = page.locator(".pf-foot").getByRole("button", { name: NATIVO ? "Abrindo pagamento…" : "Abrindo o Mercado Pago…" });
  await expect(botao).toBeDisabled();
});

test("tema Noite e Dia: o rodapé fixo do plano tem fundo próprio e o botão segue à vista nos dois temas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/plano-painel");
  for (const tema of ["dia", "noite"]) {
    await page.evaluate((t) => localStorage.setItem("mm-tema", t), tema);
    await page.reload();
    const rodape = page.locator(".pf-foot");
    await expect(rodape.getByRole("button")).toBeInViewport({ ratio: 1 });
    expect(await rodape.evaluate((el) => getComputedStyle(el).backgroundColor), `fundo do rodapé no tema ${tema}`).not.toBe("rgba(0, 0, 0, 0)");
  }
});
