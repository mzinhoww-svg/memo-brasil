import { expect, test } from "@playwright/test";
import { createViaWizard, wizardToSummary } from "./helpers";

test("termos e privacidade são páginas públicas, em rascunho até a revisão jurídica", async ({ page }) => {
  for (const [rota, titulo] of [["/termos", "Termos de uso"], ["/privacidade", "Política de privacidade"]] as const) {
    const r = await page.goto(rota);
    expect(r?.status(), rota).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    await expect(page.getByText(/rascunho/i).first()).toBeVisible();
    await expect(page.getByText("mazinhoww@gmail.com")).toBeVisible();
    await expect(page).toHaveTitle(`${titulo} · MemoriesMT`);
  }
});

test("sem aceite o organizador não cria o evento; com aceite cria", async ({ page }) => {
  await wizardToSummary(page);
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Termos de uso e a Política de privacidade/ })).toBeVisible();
  await expect(page).toHaveURL(/\/criar$/);
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await page.waitForURL(/\/criar\/pronto\//);
});

test("sem aceite o convidado não entra na festa; com aceite entra", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
  await page.getByLabel("Como te chamam na festa?").fill("Ana");
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Termos de uso e a Política de privacidade/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.getByRole("checkbox", { name: /Li e aceito/ }).check();
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await page.waitForURL(/agora$/);
});
