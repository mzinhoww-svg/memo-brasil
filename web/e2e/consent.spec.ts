import { expect, test } from "@playwright/test";
import { createViaWizard, openInviteAsGuest, wizardToSummary } from "./helpers";

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

test("organizador: diálogo 'Antes de criar' nasce com caixas desmarcadas; uma sem a outra não cria; as duas criam", async ({ page }) => {
  await wizardToSummary(page);
  await page.getByRole("button", { name: /Criar câmera/ }).click();
  const dialog = page.getByRole("dialog", { name: "Antes de criar" });
  const termos = dialog.getByRole("checkbox", { name: /Li e aceito os Termos/ });
  const politica = dialog.getByRole("checkbox", { name: /Li a Política/ });
  const aceitar = dialog.getByRole("button", { name: "Aceitar" });
  await expect(termos).not.toBeChecked();
  await expect(politica).not.toBeChecked();
  await expect(aceitar).toBeDisabled(); // nenhuma confirmação: não cria
  await termos.check();
  await expect(aceitar).toBeDisabled(); // só os Termos: a ciência da Política é outra afirmação
  await termos.uncheck();
  await politica.check();
  await expect(aceitar).toBeDisabled(); // só a Política: não aceita os Termos
  await expect(page).toHaveURL(/\/criar$/);
  await termos.check();
  await expect(aceitar).toBeEnabled();
  await aceitar.click();
  await page.waitForURL(/\/criar\/pronto\//);
});

test("convidado: sem as duas confirmações não entra na festa; com as duas entra", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await openInviteAsGuest(page, code);
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByRole("button", { name: /Entrar e fotografar/ }).click();
  const dialog = page.getByRole("dialog", { name: "Antes de fotografar" });
  const termos = dialog.getByRole("checkbox", { name: /Li e aceito os Termos/ });
  const politica = dialog.getByRole("checkbox", { name: /Li a Política/ });
  await expect(termos).not.toBeChecked();
  await expect(politica).not.toBeChecked();
  await dialog.getByRole("button", { name: "Aceitar" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await termos.check();
  await dialog.getByRole("button", { name: "Aceitar" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: ALERTA })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await politica.check();
  await dialog.getByRole("button", { name: "Aceitar" }).click();
  await page.waitForURL(/postar$/); // o convite leva direto à câmera
});
