import { expect, test } from "@playwright/test";
import { acceptTerms, seedHost } from "./helpers";

test("assistente Revela: passos 3, 4, 5 e 8 com as telas do desenho, e a câmera é criada", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await next();
  await page.getByLabel("Nome que os convidados vão ver").fill("Ana & Leo");
  await next();

  // 3 · Quando é a festa?
  await expect(page.getByRole("heading", { name: "Quando é a festa?" })).toBeVisible();
  await expect(page.getByText("3/8")).toBeVisible();
  await expect(page.getByText("câmera abre", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Horário de .+\. Dá para mudar depois nos ajustes\.$/)).toBeVisible();
  await page.getByLabel("Começa").fill("22:00");
  await page.getByLabel("Termina").fill("02:00"); // vira a meia-noite
  await expect(page.getByText(/02:00 · \S+/)).toBeVisible();
  await next();

  // 4 · Quantas poses?
  await expect(page.getByRole("heading", { name: "Quantas poses?" })).toBeVisible();
  await page.getByRole("button", { name: /^27/ }).click();
  await expect(page.locator(".rv-counter b")).toHaveText("27");
  await page.getByRole("button", { name: /^10/ }).click();
  await expect(page.locator(".rv-counter b")).toHaveText("10");
  await next();

  // 5 · Quando revelar?
  await expect(page.getByRole("heading", { name: "Quando revelar?" })).toBeVisible();
  for (const t of ["Quando a festa acabar", "No dia seguinte", "Um dia depois", "Escolher dia e hora"]) await expect(page.getByRole("button", { name: new RegExp(t) })).toBeVisible();
  await expect(page.getByText(/^Todo mundo recebe o aviso (no|na) .+, às 12:00\.$/)).toBeVisible();
  await page.getByRole("button", { name: /Escolher dia e hora/ }).click();
  await page.getByLabel("Dia e hora da revelação").fill("2000-01-01T10:00");
  await next();
  await expect(page.getByRole("heading", { name: "Quando revelar?" })).toBeVisible(); // passado: não avança
  await page.getByRole("button", { name: /No dia seguinte/ }).click();
  await next();

  await next(); // 6 filme
  await next(); // 7 quem vê

  // 8 · Escolha o plano
  await expect(page.getByRole("heading", { name: "Escolha o plano" })).toBeVisible();
  await expect(page.getByText("8/8")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Grátis/ })).toBeChecked();
  await page.getByRole("button", { name: "Criar câmera" }).click();
  await acceptTerms(page);
  await page.waitForURL(/\/criar\/pronto\//);
});
