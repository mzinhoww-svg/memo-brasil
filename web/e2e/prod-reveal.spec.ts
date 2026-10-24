import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { acceptTerms } from "./helpers";

/**
 * Revelação programada contra o ambiente publicado (cron real `mm-reveal-due`), em evento sintético "TESTE – excluir".
 * Fase ANTES (antes do horário de revelação): um convidado posta, a foto fica bloqueada e a sessão dele é guardada em E2E_STATE.
 * Fase DEPOIS (depois do horário e de uma rodada do cron): o MESMO convidado (sessão guardada) abre o Agora e vê a própria foto.
 * Com a revelação ancorada no fim, o evento termina junto e NÃO aceita convidado novo: por isso a sessão é reaproveitada.
 * E2E_BASE_URL=... E2E_EVENT_CODE=XXXXXXXX E2E_PHASE=antes|depois E2E_STATE=<arquivo fora do repo> npx playwright test -c playwright.prod-smoke.config.ts prod-reveal
 */
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const CODE = process.env.E2E_EVENT_CODE;
const PHASE = process.env.E2E_PHASE;
const STATE = process.env.E2E_STATE;
test.skip(!process.env.E2E_BASE_URL || !CODE || !PHASE || !STATE, "defina E2E_BASE_URL, E2E_EVENT_CODE, E2E_PHASE=antes|depois e E2E_STATE");

async function join(page: import("@playwright/test").Page, nome: string) {
  await page.goto(`/e/${CODE}`);
  await page.getByLabel("Como te chamam na festa?").fill(nome);
  await acceptTerms(page);
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await page.waitForURL(new RegExp(`/e/${CODE}/postar$`));
}

test("antes da revelação: o convidado posta e não vê a foto (nem a própria)", async ({ page }) => {
  test.skip(PHASE !== "antes");
  await join(page, "Convidado Antes");
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("guardada-no-escuro")).toBeVisible();
  await page.goto(`/e/${CODE}/agora`);
  await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
  await expect(page.locator(".mm-post")).toHaveCount(0);
  await page.context().storageState({ path: STATE! }); // sessão do convidado para a fase DEPOIS (arquivo fora do repositório; apague depois)
});

test("depois da revelação (cron real): o mesmo convidado abre o Agora e vê a foto", async ({ browser }) => {
  test.skip(PHASE !== "depois");
  const ctx = await browser.newContext({ storageState: STATE!, baseURL: process.env.E2E_BASE_URL });
  const page = await ctx.newPage();
  await page.goto(`/e/${CODE}/agora`);
  await expect(page.getByTestId("aguardando-revelacao")).toHaveCount(0);
  await expect(page.locator(".mm-post")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByText(/Visão de Convidado Antes/)).toBeVisible();
  await ctx.close();
});
