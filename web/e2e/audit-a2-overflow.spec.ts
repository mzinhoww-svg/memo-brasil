/* Auditoria A2: nome de evento de 60 caracteres, convidado de 44 caracteres e legenda de 140, com revelação desligada (feed visível). */
import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { ANALYZE } from "./audit-a2-analyze";
import { createViaWizard, setTheme } from "./helpers";
const EV = path.resolve(__dirname, "../../docs/audit/evidence");
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const TITLE = "Casamento de Maria Eduarda Albuquerque e João Pedro Neto 2026".slice(0, 60);
const NAME = "Maria Eduarda de Albuquerque e Souza Pereira Lima".slice(0, 40);
const CAP = "Ninguém segurou a emoção quando o pai da noiva entrou na pista e puxou a dança com a família toda, valeu demais pessoal.".slice(0, 140);

test("textos longos", async ({ browser }) => {
  test.setTimeout(300_000);
  const out: Record<string, unknown> = { title: TITLE.length, name: NAME.length, caption: CAP.length };
  for (const vp of [{ w: 375, h: 812 }, { w: 1440, h: 900 }]) for (const theme of ["dia", "noite"] as const) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await setTheme(page, theme);
    const { code, id } = await createViaWizard(page, { title: TITLE, reveal: "desligada" });
    const post = async (cap: string) => {
      await page.goto(`/e/${code}/postar`);
      await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG });
      await page.getByLabel("Legenda (opcional)").fill(cap);
      await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
      await page.getByText("Foi para o laboratório").waitFor();
    };
    await post(CAP);
    await page.goto(`/e/${code}/voce`);
    await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
    await page.getByLabel("Como te chamam na festa?").fill(NAME);
    await page.getByRole("button", { name: "Entrar na festa" }).click();
    await page.waitForURL(/agora$/);
    await post(CAP);
    for (const r of ["agora", "explorar", "voce"]) {
      await page.goto(`/e/${code}/${r}`); await page.waitForTimeout(600);
      const a = await page.evaluate(ANALYZE) as Record<string, unknown>;
      const clipped = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && s.overflowX !== "visible" && e.clientWidth > 0 && !["scroll", "auto"].includes(s.overflowX); }).map((e) => e.tagName + "." + String((e as HTMLElement).className).slice(0, 30) + ` ${e.scrollWidth}>${e.clientWidth}`).slice(0, 6));
      out[`${r}-${vp.w}-${theme}`] = { overflowX: a.overflowX, overflowingEls: a.overflowingEls, clippedText: clipped, small: (a.targets as { small: unknown[] }).small.length };
      await page.screenshot({ path: path.join(EV, "screenshots", `a2-longos-${r}-${vp.w}-${theme}.png`), animations: "disabled" });
    }
    // volta ao anfitriao e abre painel
    await page.goto("/"); const emy = page.getByRole("button", { name: /Emy/ }).first(); if (await emy.count()) { await emy.click(); await page.waitForTimeout(500); }
    for (const s of ["", "convidados", "conteudo", "qr"]) {
      await page.goto(`/painel/${id}${s ? "/" + s : ""}`); await page.waitForTimeout(600);
      const a = await page.evaluate(ANALYZE) as Record<string, unknown>;
      const clipped = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const s = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && s.overflowX !== "visible" && e.clientWidth > 0 && !["scroll", "auto"].includes(s.overflowX); }).map((e) => e.tagName + "." + String((e as HTMLElement).className).slice(0, 30) + ` ${e.scrollWidth}>${e.clientWidth}`).slice(0, 6));
      // sobreposição de texto do seletor de evento
      const sw = await page.evaluate(() => { const el = document.querySelector(".rv-event-switch"); if (!el) return null; const r = el.getBoundingClientRect(); const kids = [...el.children].map((k) => k.getBoundingClientRect().bottom); return { boxH: Math.round(r.height), childBottomMax: Math.round(Math.max(...kids)), boxBottom: Math.round(r.bottom), overflows: Math.max(...kids) > r.bottom + 1 }; });
      out[`painel${s ? "-" + s : ""}-${vp.w}-${theme}`] = { overflowX: a.overflowX, clippedText: clipped, eventSwitch: sw };
      await page.screenshot({ path: path.join(EV, "screenshots", `a2-longos-painel${s ? "-" + s : ""}-${vp.w}-${theme}.png`), animations: "disabled" });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(EV, "test-results/a2-overflow.json"), JSON.stringify(out, null, 1));
});
