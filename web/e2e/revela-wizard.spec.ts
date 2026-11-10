import { expect, test } from "@playwright/test";
import { acceptTerms, seedHost } from "./helpers";

test("assistente Revela: os 8 passos com as telas do desenho, e a câmera é criada com o filme escolhido", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");

  // 1 · Escolha a embalagem
  await expect(page.getByRole("heading", { name: "Escolha a embalagem" })).toBeVisible();
  await expect(page.getByText("1/8")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveText(["Festa", "Casamento", "Aniversário", "Noite"]);
  await page.getByRole("radio", { name: "Casamento" }).click();
  await expect(page.getByText("Marfim com faixa dourada. O nome do casal sai impresso.")).toBeVisible();
  await expect(page.getByAltText("Câmera com embalagem Casamento")).toBeVisible();
  await next();

  // 2 · Nome do evento: prévia da embalagem, chips e campo real (sem teclado desenhado)
  await expect(page.getByRole("heading", { name: "Nome do evento" })).toBeVisible();
  await expect(page.getByText("2/8")).toBeVisible();
  await expect(page.getByAltText("Embalagem com o nome do evento")).toHaveAttribute("src", "/revela/ref/label-casamento.jpg");
  await expect(page.getByText("espaço", { exact: true })).toHaveCount(0);
  await next();
  await expect(page.getByText(/^Escolha o nome do evento\./)).toBeVisible(); // vazio: não avança
  await page.getByRole("group", { name: "Sugestões de nome" }).getByRole("button").first().click();
  await expect(page.getByLabel("Nome do evento")).not.toHaveValue("");
  await page.getByLabel("Nome do evento").fill("Ana & Leo");
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

  // 6 · Qual filme? duas fotos reais lado a lado
  await expect(page.getByRole("heading", { name: "Qual filme?" })).toBeVisible();
  await expect(page.getByText("6/8")).toBeVisible();
  await expect(page.getByAltText("Sem filme")).toHaveAttribute("src", "/revela/ref/sc-bolo-natural.jpg");
  await expect(page.getByAltText("Com filme 35mm")).toHaveAttribute("src", "/revela/ref/sc-bolo.jpg");
  await expect(page.getByRole("radio", { name: "Filme 35mm" })).toBeChecked();
  await page.getByRole("radio", { name: "Natural" }).click();
  await expect(page.getByText(/^Natural: a foto como a câmera do celular viu/)).toBeVisible();
  await next();

  // 7 · Quem vê o quê
  await expect(page.getByRole("heading", { name: "Quem vê o quê" })).toBeVisible();
  await expect(page.getByText("7/8")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Convidados veem o feed" })).toBeChecked();
  // "Permitir baixar em alta" não é oferecido no assistente (sem efeito de download em alta): só o feed
  await expect(page.getByRole("switch", { name: "Permitir baixar em alta" })).toHaveCount(0);
  await next();

  // 8 · Escolha o plano
  await expect(page.getByRole("heading", { name: "Escolha o plano" })).toBeVisible();
  await expect(page.getByText("8/8")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Grátis/ })).toBeChecked();
  await page.getByRole("button", { name: "Criar câmera" }).click();
  await acceptTerms(page);
  await page.waitForURL(/\/criar\/pronto\//);

  // o filme escolhido ficou gravado no evento e aparece nos ajustes do painel
  const id = page.url().split("/criar/pronto/")[1].split(/[/?#]/)[0];
  await page.goto(`/painel/${id}/configuracoes`);
  await expect(page.getByRole("button", { name: "Filme natural" })).toBeVisible();
});
