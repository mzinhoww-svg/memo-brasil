import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, postViaFile } from "./helpers";

/** Varredura mobile do painel: cada rota rola até o fim, sem rolagem horizontal e com o último elemento à vista. */
const ROTAS = ["", "/conteudo", "/convidados", "/convites", "/convite", "/moderacao", "/downloads", "/momentos", "/aviso", "/compartilhar", "/qr", "/plano", "/aparencia", "/configuracoes", "/excluir"];
/** Todas as rotas do painel estão no PainelFrame (quadro mobile único): 1 h1, abas, rolagem normal da página. */
const MIGRADAS = ROTAS;
/** Rotas que têm aba própria (a atual leva aria-current e precisa estar à vista). */
const COM_ABA = ["", "/conteudo", "/convidados", "/momentos", "/qr", "/plano", "/aparencia", "/configuracoes", "/downloads"];

async function ultimoItemAVista(page: Page, rota: string) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const body = document.querySelector(".pf-body");
    const foot = document.querySelector(".pf-foot");
    const footBox = foot && foot.childElementCount > 0 ? foot.getBoundingClientRect() : null;
    // o último elemento visível do corpo (ignora vazios e ocultos)
    const all = Array.from(body?.querySelectorAll<HTMLElement>("*") ?? []).filter((e) => { const b = e.getBoundingClientRect(); return b.height > 0 && b.width > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]"); });
    const last = all.reduce<HTMLElement | undefined>((a, e) => (!a || e.getBoundingClientRect().bottom >= a.getBoundingClientRect().bottom ? e : a), undefined);
    const lastBottom = last?.getBoundingClientRect().bottom ?? 0;
    return { lastBottom, limit: footBox ? footBox.top : window.innerHeight, footBottom: footBox?.bottom ?? null, vh: window.innerHeight, tag: last?.tagName ?? "?" };
  });
  expect(r.lastBottom, `último item (${r.tag}) escondido em ${rota || "/"}`).toBeLessThanOrEqual(r.limit + 1);
  if (r.footBottom !== null) expect(r.footBottom, `rodapé fixo fora da tela em ${rota}`).toBeLessThanOrEqual(r.vh + 1);
}

for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`painel sem corte em ${vp.width}×${vp.height}`, async ({ page }) => {
    test.setTimeout(360_000);
    await page.setViewportSize(vp);
    const { code, id } = await createViaWizard(page, { reveal: "ao-terminar" });
    for (let i = 0; i < 3; i++) await postViaFile(page, code);
    for (const r of ROTAS) {
      await page.goto(`/painel/${id}${r}`);
      await page.waitForLoadState("networkidle");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `rolagem horizontal em ${r || "/"}`).toBeLessThanOrEqual(1);
      // nenhuma tela do painel pode esconder o fim do conteúdo atrás de overflow:hidden com altura fixa
      const cut = await page.evaluate(() => {
        const scr = document.querySelector(".scr:not(.sheet-scr)") as HTMLElement | null;
        if (!scr) return 0;
        const cs = getComputedStyle(scr);
        return cs.overflow === "hidden" && scr.scrollHeight > scr.clientHeight + 1 ? scr.scrollHeight - scr.clientHeight : 0;
      });
      expect(cut, `conteúdo cortado em ${r || "/"}`).toBe(0);
      if (!MIGRADAS.includes(r)) continue;

      // quadro único: um h1, sem migalhas, abas presentes
      await expect(page.getByRole("heading", { level: 1 }), `h1 em ${r}`).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Trilha de navegação" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Seções do painel" })).toBeVisible();
      // cabeçalho fixo: continua no topo depois de rolar
      await ultimoItemAVista(page, r);
      const topo = await page.locator(".pf-top").boundingBox();
      expect(topo?.y ?? 99, `cabeçalho fixo em ${r}`).toBeLessThanOrEqual(1);
      // abas rolam e a atual está inteira à vista
      if (COM_ABA.includes(r)) {
        const cur = page.locator('.pf-tabs [aria-current="page"]');
        await expect(cur, `aba atual em ${r}`).toHaveCount(1);
        const [cb, sb] = await Promise.all([cur.boundingBox(), page.locator(".pf-tabs").boundingBox()]);
        expect(cb!.x, `aba atual cortada à esquerda em ${r}`).toBeGreaterThanOrEqual(sb!.x - 1);
        expect(cb!.x + cb!.width, `aba atual cortada à direita em ${r}`).toBeLessThanOrEqual(sb!.x + sb!.width + 1);
      }
    }
  });
}

test("abas do painel rolam para o lado, com sombra só do lado que ainda tem abas", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 360, height: 640 });
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/downloads`); // a última aba: abre rolada para o fim
  const tabs = page.locator(".pf-tabs");
  await expect(tabs).toHaveAttribute("data-start", "true");
  await expect(tabs).toHaveAttribute("data-end", "false");
  expect(await tabs.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await tabs.evaluate((el) => { el.scrollLeft = 0; });
  await expect(tabs).toHaveAttribute("data-start", "false");
  await expect(tabs).toHaveAttribute("data-end", "true");
  // trocar de aba leva à tela e mantém um único h1
  await page.getByRole("navigation", { name: "Seções do painel" }).getByRole("link", { name: "Conteúdo" }).click();
  await page.waitForURL(/\/conteudo$/);
  await expect(page.getByRole("heading", { level: 1, name: "Conteúdo" })).toHaveCount(1);
});

test("seta de voltar leva ao pai: Aparência volta aos Ajustes, Ajustes volta ao painel", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Trocar embalagem" }).click();
  await page.waitForURL(/\/aparencia$/);
  await expect(page.getByRole("heading", { level: 1, name: "Aparência" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar" }).click();
  await page.waitForURL(/\/configuracoes$/);
  await page.getByRole("button", { name: "Voltar" }).click();
  await page.waitForURL(new RegExp(`/painel/${id}$`));
});

for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`plano, QR e visão geral no quadro em ${vp.width}×${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(vp);
    const { id } = await createViaWizard(page, { title: "Casamento Ana e Leo", reveal: "desligada" });
    const base = `/painel/${id}`;
    const abas = page.getByRole("navigation", { name: "Seções do painel" });

    // visão geral: abas, o nome do evento é o único h1, Ajustes no cabeçalho, atalhos à vista e seta para Meus eventos
    await page.goto(base);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Casamento Ana e Leo");
    await expect(abas.locator('[aria-current="page"]')).toHaveText("Geral");
    await expect(page.locator(".pf-action").getByRole("link", { name: "Ajustes" })).toBeVisible();
    await expect(page.locator(".pgrid").getByRole("link", { name: /^Plano/ })).toBeVisible();
    await expect(page.locator(".tiles")).toBeVisible();
    const ajustes = await page.locator(".pf-action .rv-icon-btn").boundingBox();
    expect(ajustes!.width).toBeGreaterThanOrEqual(44);
    expect(ajustes!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: "Voltar" }).click();
    await page.waitForURL(/\/eventos$/);

    // QR para as mesas: título do quadro, seta para Convites, modelos, proporção e o botão principal no rodapé fixo, à vista sem rolar
    await page.goto(`${base}/qr`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("QR para as mesas");
    await expect(abas.locator('[aria-current="page"]')).toHaveText("QR");
    await expect(page.getByRole("group", { name: "Modelos do cartão de mesa" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fechar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Voltar" })).toHaveCount(1);
    const baixar = page.locator(".pf-foot").getByRole("button", { name: "Baixar QR code" });
    await expect(baixar).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Voltar" }).click();
    await page.waitForURL(/\/convites$/);

    // Plano (modo local: pagamentos desligados): título do quadro e seta para os Ajustes
    await page.goto(`${base}/plano`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plano");
    await expect(abas.locator('[aria-current="page"]')).toHaveText("Plano");
    await expect(page.getByRole("heading", { level: 2, name: "De que tamanho é a festa?" })).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click();
    await page.waitForURL(/\/configuracoes$/);
  });
}
