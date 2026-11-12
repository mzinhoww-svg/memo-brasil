import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("anfitrião dentro do evento volta ao painel e a Meus eventos (aba, faixa do Feed e tela Você)", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada" });
  await postViaFile(page, code);

  await page.goto(`/e/${code}/agora`);
  await expect(page.getByTestId("host-bar")).toBeVisible();
  await page.getByRole("link", { name: "Painel do evento" }).click(); // aba
  await expect(page).toHaveURL(new RegExp(`/painel/${id}$`));

  await page.goto(`/e/${code}/voce`);
  await page.getByTestId("voce-eventos").click();
  await expect(page).toHaveURL(/\/eventos$/);

  await page.goto(`/e/${code}/voce`);
  await page.getByTestId("voce-painel").click();
  await expect(page).toHaveURL(new RegExp(`/painel/${id}$`));
});
