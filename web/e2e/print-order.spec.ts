import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile } from "./helpers";

/** Pedido de impressão (19b) em modo local: escolher a foto, contato e endereço, enviar, ver o status em Você · Álbuns impressos e cancelar. */
test("álbum impresso: pedido sem pagamento, status e cancelamento", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Impressão Host", reveal: "desligada" });
  await postViaFile(page, code);
  await page.goto(`/eventos/revelados/${id}/album`);
  await page.getByRole("button", { name: "Escolher as fotos" }).click();

  const sheet = page.getByRole("dialog", { name: "Escolher as fotos" });
  await sheet.getByRole("button", { name: "Continuar" }).click();
  await expect(sheet.getByText("Escolha pelo menos uma foto")).toBeVisible();
  await sheet.getByRole("button", { name: /^Foto de/ }).first().click();
  await expect(sheet.getByText("1 de 60 fotos escolhidas")).toBeVisible();
  await sheet.getByRole("button", { name: "Continuar" }).click();

  const form = page.getByRole("dialog", { name: "Contato e entrega" });
  await expect(form).toContainText("Sem cobrança agora");
  await form.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(form.getByText("Informe um telefone ou um e-mail")).toBeVisible();
  await form.getByLabel("Telefone com DDD").fill("65999991234");
  await expect(form.getByLabel("Telefone com DDD")).toHaveValue("(65) 99999-1234");
  await form.getByLabel("CEP").fill("78000000");
  await form.getByLabel("Rua").fill("Rua das Flores");
  await form.getByLabel("Número").fill("10");
  await form.getByLabel("Bairro").fill("Centro");
  await form.getByLabel("Cidade").fill("Cuiabá");
  await form.getByLabel("UF").fill("mt");
  await form.getByRole("button", { name: "Enviar pedido" }).click();

  const ok = page.getByRole("dialog", { name: "Pedido enviado" });
  await expect(ok.getByTestId("print-status")).toHaveText("Pedido enviado");
  await expect(ok).toContainText("1 álbum · 1 foto");
  await ok.getByRole("link", { name: "Ver meus pedidos" }).click();

  await page.waitForURL(/\/eventos\/pedidos$/);
  const row = page.getByTestId("print-order");
  await expect(row).toContainText("Impressão Host");
  await expect(row).toContainText("Pedido enviado");
  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toContainText("Cancelado");
  await expect(row.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

  // Você → Álbuns impressos leva à lista
  await page.goto("/eventos/voce");
  await page.getByRole("button", { name: /Álbuns impressos/ }).click();
  await page.waitForURL(/\/eventos\/pedidos$/);
});
