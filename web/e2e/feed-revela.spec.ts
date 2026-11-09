import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/** Feed revelado (24d–24g) em modo local: curtir, abrir a foto, comentar, curtir/denunciar comentário e denunciar a foto. */
test("feed: curtir, abrir a foto, comentar e denunciar", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "Feed Revela", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);

  const post = page.locator("article.post").first();
  await expect(post).toContainText("Ana");
  await expect(post).toContainText(/pose 1 de 10/);
  await expect(post.getByText("Nenhuma curtida ainda")).toBeVisible();
  await post.getByRole("button", { name: "Curtir" }).click();
  await expect(post.getByText("1 curtida")).toBeVisible();

  // 24f: foto aberta com a barra de reações
  await post.getByRole("button", { name: /Abrir a foto de Ana/ }).click();
  await expect(page.getByText("1 de 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Uau/ }).click();
  await expect(page.getByRole("button", { name: /^Uau/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Fechar" }).click();

  // 24e: comentários
  await post.getByRole("button", { name: "Comentar", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Comentários" });
  await sheet.getByRole("textbox", { name: "Comentário" }).fill("Que foto linda");
  await sheet.getByRole("button", { name: "Enviar" }).click();
  await expect(sheet.getByText("Que foto linda")).toBeVisible();
  await sheet.getByRole("button", { name: "Curtir comentário" }).click();
  await expect(sheet.getByRole("button", { name: "Curtir comentário" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("dialog", { name: "Comentários" }).locator(".rv-sheet__grab").click();
  await expect(post.getByText("Ver o comentário")).toBeVisible();

  // 24g: denunciar a foto pelo Mais
  await post.getByRole("button", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Pedir para remover" }).click();
  const denuncia = page.getByRole("dialog", { name: "Denunciar esta foto" });
  await denuncia.getByRole("radio", { name: "Conteúdo impróprio" }).click();
  await denuncia.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(denuncia.getByText("Denúncia enviada")).toBeVisible();
});
