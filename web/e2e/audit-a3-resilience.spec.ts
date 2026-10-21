import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createViaWizard } from "./helpers";

const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results");
const res: Record<string, unknown> = {};
test.afterAll(() => fs.writeFileSync(path.join(OUT, "a3-resilience.json"), JSON.stringify(res, null, 2)));

test("falha de escrita no IndexedDB ao criar evento", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a: Parameters<typeof orig>) {
      if ((window as unknown as { __failPut?: boolean }).__failPut) throw new DOMException("QuotaExceededError", "QuotaExceededError");
      return orig.apply(this, a);
    };
  });
  await page.goto("/criar");
  await page.getByLabel("Nome do evento").fill("Falha");
  await page.getByLabel("Seu nome").fill("Emy");
  for (let i = 0; i < 5; i++) {
    if (i === 2) await page.getByRole("button", { name: "Quando o evento terminar" }).click();
    await page.getByRole("button", { name: "Próximo" }).click();
  }
  await page.evaluate(() => ((window as unknown as { __failPut?: boolean }).__failPut = true));
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await page.waitForTimeout(2500);
  const btn = page.getByRole("button", { name: /Cri(ar|ando)/ }).last();
  res.wizardButtonText = (await btn.textContent())?.trim();
  res.wizardButtonDisabled = await btn.isDisabled();
  res.bannerVisible = await page.getByText(/indispon|armazenamento/i).first().isVisible().catch(() => false);
  res.bodyText = (await page.locator("body").innerText()).slice(0, 400);
});

test("foco do Sheet apos re-render periodico do painel", async ({ page }) => {
  test.setTimeout(90_000);
  const { id } = await createViaWizard(page, { title: "Foco" });
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Excluir evento" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await page.keyboard.press("Tab");
  const before = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.waitForTimeout(16_500);
  const after = await page.evaluate(() => document.activeElement?.textContent?.trim());
  res.sheetFocusBefore = before;
  res.sheetFocusAfter16s = after;
  res.sheetBackgroundInert = await page.evaluate(() => !!document.querySelector("#conteudo")?.closest("[inert]") || document.querySelector("main")?.hasAttribute("inert") || false);
});

test("falha de LEITURA do IndexedDB apos o app carregar", async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => { if (sessionStorage.getItem("a3-failread") === "1") throw new DOMException("UnknownError", "UnknownError"); };
    for (const proto of [IDBIndex.prototype, IDBObjectStore.prototype] as const) {
      for (const m of ["getAll", "get"] as const) {
        const o = (proto as unknown as Record<string, (...a: unknown[]) => unknown>)[m];
        (proto as unknown as Record<string, unknown>)[m] = function (this: unknown, ...a: unknown[]) {
          if (sessionStorage.getItem("a3-failread") === "1" && (this as { name?: string }).name !== "meta") fail();
          return o.apply(this, a);
        };
      }
    }
  });
  const { code } = await createViaWizard(page, { title: "Leitura" });
  await page.evaluate(() => sessionStorage.setItem("a3-failread", "1"));
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(4000);
  res.readFailureBodyText = (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 300);
});
