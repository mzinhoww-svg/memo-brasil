import { expect, test } from "@playwright/test";
import { createViaWizard } from "./helpers";

// Aparência em modo local (sem Docker). O Revela 2.0 tirou cores e fontes por evento: a identidade é a embalagem + filme + mensagem.
// Aqui: a mensagem de boas-vindas vale na entrada do convidado, não vaza para o painel nem para a abertura, e some ao limpar.
test("aparência: embalagem e mensagem valem na entrada do convidado, não vazam para a abertura, e a mensagem pode ser removida", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Tema Studio" });
  await page.goto(`/painel/${id}/aparencia`);
  await page.getByRole("radio", { name: "Casamento" }).click();
  await page.getByLabel("Mensagem de boas-vindas").fill("Bem-vindos ao nosso dia!");
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(page.getByTestId("studio-msg")).toHaveText("Aparência salva.");

  await page.goto(`/e/${code}`);
  await expect(page.getByTestId("mensagem-evento")).toHaveText("Bem-vindos ao nosso dia!");
  await page.goto("/");
  await expect(page.getByText("Bem-vindos ao nosso dia!")).toHaveCount(0);

  await page.goto(`/painel/${id}/aparencia`);
  await expect(page.getByRole("radio", { name: "Casamento" })).toBeChecked();
  await page.getByLabel("Mensagem de boas-vindas").fill("");
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(page.getByTestId("studio-msg")).toHaveText("Aparência salva.");
  await page.goto(`/e/${code}`);
  await expect(page.getByTestId("mensagem-evento")).toHaveCount(0);
});
