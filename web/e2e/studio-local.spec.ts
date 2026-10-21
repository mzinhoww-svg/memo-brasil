import { expect, test } from "@playwright/test";
import { createViaWizard } from "./helpers";

// Event Studio em modo local (sem Docker): personaliza pela interface e confere o isolamento em todas as telas do convidado.
test("tema personalizado vale nas telas do convidado, não vaza para o painel nem para a plataforma, e restaura o padrão", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Tema Studio" });
  await page.goto(`/painel/${id}/aparencia`);
  await page.getByRole("button", { name: "Oceano" }).click();
  await page.getByLabel("Mensagem de boas-vindas").fill("Bem-vindos ao nosso dia!");
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await expect(page.getByText("Aparência salva.")).toBeVisible();

  const superficie = async () => { await page.locator("[data-event-theme]").first().waitFor(); return page.evaluate(() => {
    const w = document.querySelector("[data-event-theme]")!;
    return { modo: w.getAttribute("data-event-theme"), v: getComputedStyle(w).getPropertyValue("--evento-superficie").trim().toUpperCase(), root: getComputedStyle(document.documentElement).getPropertyValue("--evento-superficie").trim().toUpperCase() };
  }); };
  // painel do organizador: Platform DS, não herda o tema personalizado
  await page.goto(`/painel/${id}`);
  expect((await superficie()).modo).toBe("palette");
  // convite, entrada e telas do convidado (câmera, espera/agora, explorar, você, retrospectiva)
  await page.goto(`/e/${code}`);
  await expect(page.getByTestId("mensagem-evento")).toHaveText("Bem-vindos ao nosso dia!");
  const entrada = await superficie();
  expect(entrada.modo).toBe("custom"); expect(entrada.v).toBe("#E2ECF1");
  // o organizador também percorre as telas do convidado neste aparelho (modo local)
  for (const rota of ["agora", "postar", "explorar", "voce", "retrospectiva"]) {
    await page.goto(`/e/${code}/${rota}`);
    await page.waitForLoadState("networkidle");
    const t = await superficie();
    expect(t.modo, rota).toBe("custom"); expect(t.v, rota).toBe("#E2ECF1");
    expect(t.root, rota).not.toBe("#E2ECF1"); // nunca em :root
  }
  // a marca da plataforma (home) não muda
  await page.goto("/");
  await expect(page.locator("[data-event-theme]")).toHaveCount(0);
  // restaurar o padrão
  await page.goto(`/painel/${id}/aparencia`);
  await page.getByRole("button", { name: "Restaurar tema padrão" }).click();
  await expect(page.getByText("Tema padrão restaurado.")).toBeVisible();
  await page.goto(`/e/${code}`);
  await expect(page.getByTestId("mensagem-evento")).toHaveCount(0);
  expect((await superficie()).modo).toBe("palette");
});
