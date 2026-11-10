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

test("24i abre pelo sino com a folha do e-mail; 24j mostra link inválido sem servidor", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "Aviso e-mail", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await page.getByRole("link", { name: "Notificações" }).click();
  await page.waitForURL(/aviso-email$/);
  const sheet = page.getByRole("dialog", { name: "Aviso por e-mail" });
  await expect(sheet).toContainText("o único e-mail que enviamos");
  await expect(page.getByText("Revelou, Ana.")).toBeVisible();
  await sheet.getByRole("button", { name: "Voltar ao feed" }).click();
  await page.waitForURL(/agora$/);

  await page.goto("/email/sair?t=0b9a5c2e-6f0e-4e7e-9f55-1d8c2d2f7a10");
  await expect(page.getByRole("heading", { name: /Esse link não/ })).toBeVisible();
  await page.goto("/email/sair");
  await expect(page.getByRole("heading", { name: /Esse link não/ })).toBeVisible();
});

test("revelados do anfitrião: galeria (18), foto aberta (19) e álbum impresso (19b)", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Revelados Host", reveal: "desligada" });
  await postViaFile(page, code);
  await page.goto("/eventos/revelados");
  await expect(page.getByRole("heading", { name: "Revelado." })).toBeVisible();
  await expect(page.getByText(/Revelados Host · 1 foto/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar tudo" })).toHaveAttribute("href", `/painel/${id}/downloads`);

  // 19: foto aberta, destaque e mais opções
  await page.locator(".table a.rv-print").first().click();
  await page.waitForURL(new RegExp(`/eventos/revelados/${id}/[0-9a-f-]+$`));
  await expect(page.getByText("1 de 1", { exact: true })).toBeVisible();
  const star = page.getByRole("button", { name: "Destacar" });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mais" }).click();
  const sheet = page.getByRole("dialog", { name: "Mais opções" });
  await expect(sheet).toContainText("Quem reagiu");
  await sheet.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("link", { name: "Fechar" }).click();

  // 19b: álbum impresso
  await page.getByRole("link", { name: "Ver como álbum" }).click();
  await expect(page.getByRole("heading", { name: /O álbum da festa/ })).toBeVisible();
  await expect(page.getByText("1 foto escolhida por você")).toBeVisible();
  await expect(page.getByRole("button", { name: "Escolher as fotos" })).toBeVisible(); // abre o pedido de impressão (e2e/print-order.spec.ts)
});
