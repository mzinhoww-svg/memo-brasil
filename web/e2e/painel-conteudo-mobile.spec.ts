import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/** Conteúdo no celular (390×844): 30 fotos, rolar até a última e até "Revelar agora", abrir uma foto. */
test("Conteúdo: 30 fotos rolam até o fim, 'Revelar agora' fica à vista e a foto abre grande", async ({ page }) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { code, id } = await createViaWizard(page, { reveal: "ao-terminar", title: "Conteúdo mobile" });
  // o Grátis dá 10 poses por pessoa: 3 pessoas × 10 fotos
  for (let i = 0; i < 10; i++) await postViaFile(page, code);
  for (const nome of ["Ana", "Beto"]) {
    await switchPerson(page, code, nome);
    for (let i = 0; i < 10; i++) await postViaFile(page, code);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Emy", exact: true }).click();

  await page.goto(`/painel/${id}/conteudo`);
  await expect(page.getByTestId("conteudo-contagem")).toHaveText("30 fotos · 0 removidas");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conteúdo");
  await expect(page.getByText("Toque numa foto para ver e tirar do álbum.")).toBeVisible();
  const tiles = page.locator(".cont-tile");
  await expect(tiles).toHaveCount(30);
  // legenda com autor e hora
  await expect(tiles.first().locator(".cont-cap")).toContainText(/^(Emy|Ana|Beto) · \d{2}:\d{2}$/);
  // 2 colunas no celular
  const xs = await tiles.evaluateAll((els) => new Set(els.slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().x))).size);
  expect(xs).toBe(2);

  // "Revelar agora" está sempre à vista no rodapé fixo, no topo e no fim da lista
  const revelar = page.getByRole("button", { name: "Revelar agora" });
  await expect(revelar).toBeInViewport({ ratio: 1 });
  await tiles.last().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(revelar).toBeInViewport({ ratio: 1 });
  // a última foto aparece inteira acima do rodapé fixo (não fica por baixo dele)
  const [ultima, rodape] = await Promise.all([tiles.last().boundingBox(), page.locator(".pf-foot").boundingBox()]);
  expect(ultima!.y + ultima!.height).toBeLessThanOrEqual(rodape!.y + 1);
  const horiz = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(horiz).toBeLessThanOrEqual(1);
  // cabeçalho continua fixo
  expect((await page.locator(".pf-top").boundingBox())!.y).toBeLessThanOrEqual(1);

  // abrir uma foto: visualização grande com as ações; Esc fecha e o foco volta à foto
  const primeira = page.getByRole("button", { name: /^Foto de/ }).first();
  await primeira.click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("img", { name: /^Foto de/ })).toBeVisible();
  for (const nome of ["Tirar do álbum", "Destacar", "Excluir a foto"]) await expect(dlg.getByRole("button", { name: nome })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(primeira).toBeFocused();

  // o botão voltar do navegador fecha a folha e continua em Conteúdo
  await primeira.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/painel/${id}/conteudo$`));

  // tirar do álbum atualiza a contagem e o filtro "Removidas" mostra a foto
  await primeira.click();
  await page.getByRole("dialog").getByRole("button", { name: "Tirar do álbum" }).click();
  await expect(page.getByTestId("conteudo-contagem")).toHaveText("30 fotos · 1 removida");
  await page.getByRole("group", { name: "Filtrar fotos" }).getByRole("button", { name: /Removidas/ }).click();
  await expect(tiles).toHaveCount(1);
  await expect(page.getByText("Removida", { exact: true })).toBeVisible();
});
