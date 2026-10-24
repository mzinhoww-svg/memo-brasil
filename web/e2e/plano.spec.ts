import { expect, test } from "@playwright/test";
import { createViaWizard } from "./helpers";

// Modo local (sem backend): cobrança não existe; a rota nova abre em B7 e nunca oferece pagamento.
test("modo local: /painel/[id]/plano mostra B7 (Evento maior?) e o item Plano na navegação", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Plano local" });
  await page.goto(`/painel/${id}`);
  await page.getByRole("navigation", { name: "Administração do evento" }).getByRole("link", { name: "Plano" }).click();
  await expect(page).toHaveURL(new RegExp(`/painel/${id}/plano$`));
  await expect(page.getByRole("heading", { level: 1, name: "De que tamanho é a festa?" })).toBeVisible();
  await expect(page.getByText("Seu plano")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evento maior?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tenho um código" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pagar/ })).toHaveCount(0);
});

test("modo local: código no modo local não vira 'inválido' (falha técnica tem mensagem própria)", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Codigo local" });
  await page.goto(`/painel/${id}/plano`);
  await page.getByRole("textbox", { name: "Código" }).fill("mmt 7kq4 xr2p");
  await expect(page.getByRole("textbox", { name: "Código" })).toHaveValue("MMT 7KQ4 XR2P");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText(/Não foi possível aplicar o código agora/)).toBeVisible();
});

test("rota nova sem sessão/evento: não trava e não mostra cobrança", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/painel/11111111-1111-4111-8111-111111111111/plano");
  await expect(page.getByRole("heading", { level: 1, name: "Não achamos este evento." })).toBeVisible();
  await expect(page.getByText("De que tamanho é a festa?")).toHaveCount(0);
  await ctx.close();
});
