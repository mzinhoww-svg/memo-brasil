import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/** A retrospectiva abre assim que as fotos são reveladas, mesmo com a festa ainda em andamento (antes só abria no fim do evento). */
test("revelou no meio da festa: o feed mostra o link da retrospectiva e Downloads libera o cartão", async ({ page }) => {
  const MIN = 60_000;
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  const d = new Date(t0 + 3 * MIN);
  const { code, id } = await createViaWizard(page, { title: "Retrospectiva cedo", reveal: { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" } });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.clock.fastForward("04:00"); // revelou; a festa (6 h) segue
  await page.goto(`/e/${code}/agora`);
  await expect(page.locator("article.post").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver a retrospectiva" })).toBeVisible();
  await page.getByRole("link", { name: "Ver a retrospectiva" }).click();
  await expect(page.getByText("A retrospectiva ainda não abriu.")).toHaveCount(0);

  // volta a ser o anfitrião e confere o cartão em Downloads
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.getByRole("button", { name: "Emy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Você está dentro, Emy." })).toBeVisible();
  await page.goto(`/painel/${id}/downloads`);
  await expect(page.getByText("Disponível agora")).toBeVisible();
  await expect(page.getByText("Disponível depois da revelação")).toHaveCount(0);
});
