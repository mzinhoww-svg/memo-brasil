import { expect, test } from "@playwright/test";
import { createViaWizard, wizardToSummary } from "./helpers";

// Build público (sem flags de desenvolvimento): nada de homologação na experiência do cliente e do convidado.

test("landing pública não traz demonstração, exemplo sintético nem guia de componentes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Entrar com código" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toBeVisible();
  for (const t of [/festa de exemplo/i, /exemplo com revelação/i, /Guia de componentes/i]) await expect(page.getByText(t)).toHaveCount(0);
});

test("rota técnica /design não é pública", async ({ page }) => {
  const r = await page.goto("/design");
  expect(r?.status()).toBe(404);
});

test("resumo do wizard não anuncia preço, gratuidade nem demonstração", async ({ page }) => {
  await wizardToSummary(page, { capacity: "50" });
  await expect(page.getByRole("heading", { name: "Confirme o seu evento" })).toBeVisible();
  await expect(page.getByText(/gratuit|teria valor|demonstra|cobrad/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Criar evento", exact: true })).toBeVisible();
});

test("telas do evento (Você e configurações) sem texto de demonstração", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { capacity: "50" });
  await page.goto(`/e/${code}/voce`);
  await expect(page.getByRole("heading", { name: /Você|dentro/i }).first()).toBeVisible();
  await expect(page.getByText(/Demonstração|Entrar como outra pessoa/)).toHaveCount(0);
  await page.goto(`/painel/${id}/configuracoes`);
  await expect(page.getByText("Regras da festa")).toBeVisible();
  await expect(page.getByText(/teria valor|demonstra|cobrad/i)).toHaveCount(0);
});
