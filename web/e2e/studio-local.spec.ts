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

// Decisão do dono: a aparência (embalagem, filme, mensagem, QR, imagens) continua editável depois da revelação.
test("aparência depois da revelação: sem aviso de trava, e embalagem e mensagem ainda salvam", async ({ page }) => {
  const MIN = 60_000;
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  const d = new Date(t0 + 3 * MIN);
  const { id } = await createViaWizard(page, { title: "Revelado e editável", reveal: { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" } });
  await page.clock.fastForward("04:00"); // a revelação venceu
  await page.goto(`/painel/${id}/aparencia`);
  await expect(page.getByText(/não pode mais mudar/)).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Noite" })).toBeEnabled();
  await page.getByRole("radio", { name: "Noite" }).click();
  await page.getByLabel("Mensagem de boas-vindas").fill("Valeu por ter vindo!");
  await expect(page.getByRole("button", { name: "Salvar aparência" })).toBeEnabled();
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(page.getByTestId("studio-msg")).toHaveText("Aparência salva.");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Noite" })).toBeChecked();
  await expect(page.getByLabel("Mensagem de boas-vindas")).toHaveValue("Valeu por ter vindo!");
});
