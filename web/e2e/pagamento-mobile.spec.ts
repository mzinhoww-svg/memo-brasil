import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { SB_READY, admin, makeEvent, makeUser, openPlano, type TestUser } from "./payments-sim";

// Jornada de pagamento no celular (360, 390 e 430 px), modo Supabase LOCAL com backend simulado (page.route) e SEM Mercado Pago real.
// Prova: sem rolagem horizontal, alvos de toque >= 44 px, CTA visível sem rolar (inclusive com a viewport reduzida pelo teclado)
// e resumo do pedido. EMULAÇÃO de viewport/toque no Chromium: não substitui aparelho físico nem teste em app nativo.
test.skip(!SB_READY, "precisa de Supabase local e das chaves no ambiente");
test.describe.configure({ mode: "serial" });

const LONG = "Casamento de Maria Eduarda e João Pedro de Albuquerque Cavalcanti Nogueira"; // perto do limite de título
const SHOTS = path.resolve(__dirname, "../../docs/evidence/pagamento-mobile");
const SIZES = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
let owner: TestUser;
let eventId: string;

test.beforeAll(async () => {
  owner = await makeUser("mob");
  eventId = await makeEvent(owner, LONG);
  fs.mkdirSync(SHOTS, { recursive: true });
});
test.afterAll(async () => {
  if (eventId) await admin.from("events").delete().eq("id", eventId);
});

for (const vp of SIZES) {
  test(`plano em ${vp.width}px: sem rolagem lateral, alvos >= 44px e CTA visível sem rolar (inclusive em tela baixa)`, async ({ browser, baseURL }) => {
    const { ctx, page, goto } = await openPlano(browser, owner, eventId, baseURL!, "", vp);
    await goto();
    const pay = page.getByRole("button", { name: /Pagar com Mercado Pago/ });
    await expect(pay).toBeVisible();
    await expect(page.getByTestId("resumo-pedido")).toContainText("Pagamento único");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(pay).toBeInViewport({ ratio: 1 });
    const alturas = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".plano-card, .mm-btn--cta")].map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(alturas.length).toBeGreaterThan(0);
    for (const h of alturas) expect(h).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: path.join(SHOTS, `plano-${vp.width}.png`), fullPage: false });
    await ctx.close();
    // tela baixa (celular pequeno, 568 px de altura): o CTA continua à mão. Teclado aberto NÃO é provado aqui (a emulação do
    // Chromium não reduz a viewport de layout como um teclado real): fica para teste em aparelho físico.
    const small = await openPlano(browser, owner, eventId, baseURL!, "", { width: vp.width, height: 568 });
    await small.goto();
    await expect(small.page.getByRole("button", { name: /Pagar com Mercado Pago/ })).toBeInViewport({ ratio: 1 });
    await small.ctx.close();
  });
}
