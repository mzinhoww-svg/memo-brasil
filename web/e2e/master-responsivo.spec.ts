import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* Master responsivo. O console de verdade (/master/*) exige Supabase e operador logado (coberto por master-studio.spec.ts e session.spec.ts);
   aqui o navegador abre as MESMAS telas do console pelas rotas de desenho (/dev/revela/Master-*, uma por rota e estado: lista, vazio, erro,
   sem permissão, carregando e folhas) e a moldura com links reais (/dev/master-menu). Precisa do build com NEXT_PUBLIC_MM_DEV_TOOLS=1. */

const SCREENS = [...readFileSync(resolve(process.cwd(), "src/revela/registry.ts"), "utf8").matchAll(/"html": "(Master-[^"]+)"/g)].map((m) => m[1])
  // estas 3 telas de erro passam um handler do servidor para um componente de cliente e dão 500 na rota de desenho /dev/revela (já era assim antes do menu responsivo)
  .filter((n) => !["Master-impressoes--erro", "Master-impressao-detalhe--erro", "Master-config-revisada--erro"].includes(n));
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
const MENU = "/dev/master-menu";

test("há telas do Master para cobrir (uma por rota do console e por estado)", () => {
  expect(SCREENS.length).toBeGreaterThanOrEqual(95);
});

async function ready(page: Page) {
  await page.locator(".dsk, .mmodal").first().waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
}
const noPageScroll = (page: Page) => page.evaluate(() => ({ sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), iw: window.innerWidth }));

for (const vp of VIEWPORTS) {
  test(`a página não rola na horizontal em nenhuma tela do Master a ${vp.width}×${vp.height}`, async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize(vp);
    const bad: string[] = [];
    for (const name of SCREENS) {
      await page.goto(`/dev/revela/${name}`);
      await ready(page);
      const { sw, iw } = await noPageScroll(page);
      if (sw > iw) bad.push(`${name}: scrollWidth ${sw} > ${iw}`);
      // folhas: o cartão cabe na janela
      const card = page.locator(".mmodal-card").first();
      if (await card.count()) {
        const box = await card.boundingBox();
        if (box && (box.x < -0.5 || box.x + box.width > iw + 0.5)) bad.push(`${name}: folha fora da janela (${Math.round(box.x)}..${Math.round(box.x + box.width)})`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test.describe("celular 390×844: menu em gaveta", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("começa fechado; o botão abre com fundo escurecido; Esc e o fundo fecham e devolvem o foco", async ({ page }) => {
    await page.goto(MENU);
    await ready(page);
    const aside = page.locator("aside.mside");
    const abrir = page.getByRole("button", { name: "Abrir menu" });
    await expect(abrir).toHaveAttribute("aria-expanded", "false");
    await expect(aside).toBeHidden();
    await expect(aside).toHaveAttribute("inert", "");
    expect((await abrir.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    expect((await abrir.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await abrir.click();
    await expect(aside).toBeVisible();
    await expect(page.getByRole("button", { name: "Recolher menu" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Recolher menu" })).toHaveAttribute("aria-controls", (await aside.getAttribute("id"))!);
    await expect(aside).not.toHaveAttribute("inert", "");
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    expect(await page.evaluate(() => !!document.activeElement?.closest("aside.mside"))).toBe(true);
    const bg = await page.locator(".mscrim").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgba\(0, 0, 0, 0?\.\d+\)/);

    await page.keyboard.press("Escape");
    await expect(aside).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(aside).toBeVisible();
    await page.mouse.click(370, 400); // fora da gaveta (300 px), em cima do fundo
    await expect(aside).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();
  });

  test("o foco fica preso na gaveta aberta (Tab e Shift+Tab dão a volta)", async ({ page }) => {
    await page.goto(MENU);
    await ready(page);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest("aside.mside"))).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("aside.mside"))).toBe(true);
  });

  test("tocar num item navega para a rota do módulo", async ({ page }) => {
    await page.goto(MENU);
    await ready(page);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const item = page.getByRole("link", { name: "Pagamentos" });
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await item.click();
    await expect(page).toHaveURL(/\/master\/pagamentos$/);
    // a página nova nasce com o menu fechado
    await expect(page.locator("aside.mside")).toHaveCount(0); // sem Supabase o console mostra só o aviso de indisponível
  });

  test("a tabela rola por dentro e a página não rola na horizontal", async ({ page }) => {
    await page.goto(MENU);
    await ready(page);
    const { sw, iw } = await noPageScroll(page);
    expect(sw).toBeLessThanOrEqual(iw);
    const table = page.locator(".mtable").first();
    const m = await table.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, ox: getComputedStyle(el).overflowX }));
    expect(m.ox).toBe("auto");
    expect(m.sw).toBeGreaterThan(m.cw);
    await table.evaluate((el) => { el.scrollLeft = 200; });
    expect(await table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    expect((await noPageScroll(page)).sw).toBeLessThanOrEqual(iw);
    await expect(table).toHaveAttribute("tabindex", "0");
  });

  test("a barra de cima fica fixa no topo ao rolar a página", async ({ page }) => {
    await page.goto(`/dev/revela/Master-eventos`);
    await ready(page);
    await page.evaluate(() => window.scrollTo(0, 300));
    const top = await page.locator(".mtop").evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThanOrEqual(1);
  });

  test("alvos de toque de 44 px em botões, chips, segmentos e campos de todas as telas", async ({ page }) => {
    test.setTimeout(240_000);
    const small: string[] = [];
    for (const name of SCREENS) {
      await page.goto(`/dev/revela/${name}`);
      await ready(page);
      const found = await page.evaluate(() => {
        const sel = ".dsk button, .dsk .rv-btn, .dsk .chip, .dsk .seg a, .dsk .mfield, .dsk .msearch, .mmodal button, .mmodal .rv-btn, .dsk .mpager > div > *";
        return [...document.querySelectorAll<HTMLElement>(sel)]
          .filter((el) => !el.closest(".phonepv, aside.mside, .mscrim") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest("[aria-hidden='true']"))
          .map((el) => { const r = el.getBoundingClientRect(); return { cls: `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), txt: (el.textContent ?? "").trim().slice(0, 20) }; })
          .filter((r) => r.h < 43.5 || (r.w < 43.5 && !r.txt));
      });
      for (const f of found) small.push(`${name}: ${f.cls} "${f.txt}" ${f.w}×${f.h}`);
    }
    expect(small, small.join("\n")).toEqual([]);
  });
});

test.describe("desktop: menu recolhível em trilho de ícones", () => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    test(`recolher deixa só ícones, mantém os 13 itens e persiste ao recarregar a ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(MENU);
      await ready(page);
      await page.evaluate(() => localStorage.removeItem("mm.master.rail"));
      await page.reload();
      await ready(page);
      const aside = page.locator("aside.mside");
      await expect(page.locator("aside.mside a.mnav")).toHaveCount(13);
      expect((await aside.boundingBox())!.width).toBe(248);
      await expect(page.locator("aside.mside a.mnav span").first()).toBeVisible();
      expect((await noPageScroll(page)).sw).toBeLessThanOrEqual(vp.width);

      const botao = page.getByRole("button", { name: "Recolher menu" });
      await expect(botao).toHaveAttribute("aria-expanded", "true");
      await botao.click();
      await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveAttribute("aria-expanded", "false");
      await expect(async () => { expect((await aside.boundingBox())!.width).toBe(68); }).toPass();
      expect((await aside.boundingBox())!.width).toBe(68);
      await expect(page.locator("aside.mside a.mnav span").first()).toBeHidden();
      await expect(page.locator("aside.mside a.mnav")).toHaveCount(13);
      // rótulo continua acessível e vira tooltip
      const eventos = page.getByRole("link", { name: "Eventos" });
      await expect(eventos).toHaveAttribute("title", "Eventos");
      expect(await page.evaluate(() => localStorage.getItem("mm.master.rail"))).toBe("1");
      expect((await noPageScroll(page)).sw).toBeLessThanOrEqual(vp.width);

      await page.reload();
      await ready(page);
      expect(await page.evaluate(() => document.documentElement.getAttribute("data-mrail"))).toBe("1");
      await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveAttribute("aria-expanded", "false");
      expect((await aside.boundingBox())!.width).toBe(68);

      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(async () => { expect((await aside.boundingBox())!.width).toBe(248); }).toPass();
      await expect(page.locator("aside.mside a.mnav span").first()).toBeVisible();
      await page.reload();
      await ready(page);
      expect((await aside.boundingBox())!.width).toBe(248);
    });
  }

  test("no desktop o menu fica visível e a tabela cabe sem rolar por dentro", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(MENU);
    await ready(page);
    await expect(page.locator("aside.mside")).toBeVisible();
    await expect(page.locator(".mscrim")).toBeHidden();
    const m = await page.locator(".mtable").first().evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(m.sw).toBeLessThanOrEqual(m.cw);
  });
});

test.describe("tablet 768×1024", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test("menu em gaveta, conteúdo em largura total e sem rolagem horizontal", async ({ page }) => {
    await page.goto(MENU);
    await ready(page);
    await expect(page.locator("aside.mside")).toBeHidden();
    expect((await noPageScroll(page)).sw).toBeLessThanOrEqual(768);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator("aside.mside")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("aside.mside")).toBeHidden();
  });
});

const AXE_SCREENS = ["Master-login", "Master-sem-acesso", "Master-visao-atividade", "Master-visao-atividade--tabela", "Master-eventos", "Master-evento-detalhe", "Master-planos", "Master-pagamentos", "Master-pagamento-detalhe",
  "Master-cortesias", "Master-revelacoes", "Master-lgpd", "Master-pessoas-contas", "Master-pessoas-equipe", "Master-moderacao-motivos", "Master-saude-completa", "Master-auditoria-filtros", "Master-impressoes",
  "Master-impressao-detalhe", "Master-config-revisada", "Master-revelar-agora--folha", "Master-exportar--folha", "Master-pagamentos--folha-conciliar-codigo", "Master-eventos-teste--folha-excluir-lote"];
for (const tema of ["noite", "dia"] as const) {
  test(`axe: 0 violações nas telas principais do Master a 390 px (tema ${tema})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((t) => localStorage.setItem("mm-tema", t), tema);
    const problems: string[] = [];
    for (const route of [MENU, ...AXE_SCREENS.map((n) => `/dev/revela/${n}`)]) {
      await page.goto(route);
      await ready(page);
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t === "dia" ? "light" : "dark"), tema);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`${route} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("axe com a gaveta aberta a 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(MENU);
  await ready(page);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.locator("aside.mside")).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});
