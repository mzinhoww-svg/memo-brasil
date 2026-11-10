import { expect, test } from "@playwright/test";
import { createViaWizard, wizardToSummary } from "./helpers";

const ALERTA = /Aceite os Termos de Uso e confirme a leitura da Política de Privacidade/;

test("termos e privacidade são páginas públicas na versão 2026-10-22-v1, sem aviso de rascunho", async ({ page }) => {
  for (const [rota, titulo, aba] of [["/termos", "Termos de uso", "Termos"], ["/privacidade", "Política de privacidade", "Privacidade"]] as const) {
    const r = await page.goto(rota);
    expect(r?.status(), rota).toBe(200);
    await expect(page.getByRole("tab", { name: aba, selected: true })).toBeVisible();
    await expect(page.getByText("ATUALIZADO EM 22 DE OUTUBRO DE 2026 · VERSÃO 2026-10-22-V1")).toBeVisible();
    await expect(page.getByText(/rascunho|revisão jurídica/i)).toHaveCount(0);
    await expect(page.getByText("mazinhoww@gmail.com").first()).toBeVisible();
    await expect(page.getByText("Aurimar Espindola Nogueira").first()).toBeVisible();
    await expect(page.getByText(/90 dias após o encerramento do evento/).first()).toBeVisible();
    await expect(page.getByText(/em até 30 dias/).first()).toBeVisible();
    await expect(page).toHaveTitle(`${titulo} · Revela`);
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
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await page.getByRole("checkbox", { name: /Li e aceito os Termos/ }).check();
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await expect(page.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.getByRole("checkbox", { name: /Li a Política/ }).check();
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await page.waitForURL(/postar$/); // o convite leva direto à câmera
});
