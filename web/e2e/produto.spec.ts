import { expect, test } from "@playwright/test";
import { createViaWizard } from "./helpers";

// Experiência pública sem demonstração (Task 10) e defeitos de sessão/identidade (Task 11), no modo local.

test("home não mostra 'Guia de componentes' nem botões de exemplo; /exemplo abre o Agora com selo de exemplo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A festa vista por todo mundo." })).toBeVisible();
  for (const t of [/Guia de componentes/i, /festa de exemplo/i, /revelação em 2 minutos/i]) await expect(page.getByText(t)).toHaveCount(0);
  await page.getByRole("link", { name: "Ver como funciona" }).click();
  await page.waitForURL(/\/exemplo$/);
  await expect(page.getByTestId("selo-exemplo")).toHaveText("Exemplo · nada é salvo");
  await expect(page.getByRole("heading", { name: "Lu faz 40", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agora", level: 2 })).toBeVisible();
  await expect(page.getByAltText(/Foto de exemplo de/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
});

test("/exemplo: até 5 fotos, nada vai para o IndexedDB e o selo some ao sair", async ({ page }) => {
  await page.goto("/exemplo");
  await expect(page.getByText("Fotos restantes")).toBeVisible();
  const shoot = page.getByRole("button", { name: "Tirar foto de exemplo" });
  await expect(page.getByRole("status").filter({ hasText: /Preparando/ })).toHaveCount(0);
  for (let i = 0; i < 5; i++) { await expect(shoot).toBeEnabled(); await shoot.click(); await expect(page.getByText(String(4 - i), { exact: true }).first()).toBeVisible(); }
  await expect(page.getByRole("button", { name: "Rolo acabou" })).toBeDisabled();
  const stored = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "memoriesmt")) return 0;
    const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
    return await new Promise<number>((res) => { const r = db.transaction("events").objectStore("events").count(); r.onsuccess = () => res(r.result); });
  });
  expect(stored).toBe(0);
  await page.getByRole("link", { name: "Sair" }).click();
  await page.waitForURL("/");
});

test("home com ?erro=login mostra o banner e ele pode ser fechado", async ({ page }) => {
  await page.goto("/?erro=login");
  const banner = page.getByRole("alert").filter({ hasText: "Não conseguimos entrar com o Google. Tente de novo." });
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Fechar aviso" }).click();
  await expect(banner).toHaveCount(0);
});

test("painel com id inválido mostra não encontrado em menos de 2 s", async ({ page }) => {
  await page.goto("/painel/isso-nao-e-um-uuid");
  await expect(page.getByRole("heading", { name: "Não achamos este evento." })).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole("link", { name: "Ir para meus eventos" })).toHaveAttribute("href", "/");
});

test("clipboard negado não diz copiado e deixa o link selecionado", async ({ page }) => {
  await createViaWizard(page, {});
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("negado")) } }));
  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByText("Não conseguimos copiar. O link está selecionado.")).toBeVisible();
  await expect(page.getByText(/Link copiado/)).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("link-convite");
});

test("configurações confirmam 'Salvo.' ao mudar uma regra", async ({ page }) => {
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: "24", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvo." })).toBeVisible();
});
