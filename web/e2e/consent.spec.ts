import { expect, test } from "@playwright/test";
import { createViaWizard, wizardToSummary } from "./helpers";

const ALERTA = /Aceite os Termos de Uso e confirme a leitura da Política de Privacidade/;

test("termos e privacidade são páginas públicas na versão 2026-10-22-v1, sem aviso de rascunho", async ({ page }) => {
  for (const [rota, titulo] of [["/termos", "Termos de uso"], ["/privacidade", "Política de privacidade"]] as const) {
    const r = await page.goto(rota);
    expect(r?.status(), rota).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
    await expect(page.getByText("Versão: 2026-10-22-v1 · Atualização: 22 de outubro de 2026")).toBeVisible();
    await expect(page.getByText(/rascunho|revisão jurídica/i)).toHaveCount(0);
    await expect(page.getByText("mazinhoww@gmail.com").first()).toBeVisible();
    await expect(page.getByText("Aurimar Espindola Nogueira").first()).toBeVisible();
    await expect(page.getByText(/90 dias após o encerramento do evento/).first()).toBeVisible();
    await expect(page.getByText(/em até 30 dias/).first()).toBeVisible();
    await expect(page).toHaveTitle(`${titulo} · MemoriesMT`);
  }
});

test("organizador: caixas nascem desmarcadas; uma sem a outra não cria; as duas criam", async ({ page }) => {
  await wizardToSummary(page);
  const termos = page.getByRole("checkbox", { name: /Li e aceito os Termos/ });
  const politica = page.getByRole("checkbox", { name: /Li a Política/ });
  await expect(termos).not.toBeChecked();
  await expect(politica).not.toBeChecked();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await termos.check();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible(); // só os Termos: a ciência da Política é outra afirmação
  await termos.uncheck();
  await politica.check();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible(); // só a Política: não aceita os Termos
  await expect(page).toHaveURL(/\/criar$/);
  await termos.check();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await page.waitForURL(/\/criar\/pronto\//);
});

test("convidado: sem as duas confirmações não entra na festa; com as duas entra", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
  await page.getByLabel("Como te chamam na festa?").fill("Ana");
  await expect(page.getByRole("checkbox", { name: /Li e aceito os Termos/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Li a Política/ })).not.toBeChecked();
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await page.getByRole("checkbox", { name: /Li e aceito os Termos/ }).check();
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.getByRole("checkbox", { name: /Li a Política/ }).check();
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await page.waitForURL(/agora$/);
});
