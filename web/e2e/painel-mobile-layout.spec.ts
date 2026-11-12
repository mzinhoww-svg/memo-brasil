import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile } from "./helpers";

/** Varredura mobile do painel: cada rota rola até o fim, sem rolagem horizontal e com o último elemento à vista. */
const ROTAS = ["", "/conteudo", "/convidados", "/convites", "/moderacao", "/downloads", "/momentos", "/aviso", "/qr", "/plano", "/aparencia", "/configuracoes"];

for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`painel sem corte em ${vp.width}×${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(vp);
    const { code, id } = await createViaWizard(page, { reveal: "desligada" });
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
    }
  });
}
