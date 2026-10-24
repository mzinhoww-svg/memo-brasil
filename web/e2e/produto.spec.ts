import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, seedHost } from "./helpers";

// Experiência pública sem demonstração (Task 10) e defeitos de sessão/identidade (Task 11), no modo local.

test("home mostra proposta, 3 passos e CTA criar, sem exemplo em banco nem guia de componentes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CÂMERA DESCARTÁVEL COLETIVA")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seu evento pelo olhar de cada convidado.", level: 1 })).toBeVisible();
  await expect(page.getByText("Sem baixar app. As fotos ficam no escuro e aparecem juntas, na hora que você escolher.")).toBeVisible();
  for (const t of ["Aponta para o QR da mesa", "Cada um tem seu rolo", "Tudo revela junto"]) await expect(page.getByText(t, { exact: true })).toBeVisible();
  await expect(page.getByText("Grátis até 10 convidados.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
  await expect(page.getByRole("link", { name: "Tenho um código" })).toHaveAttribute("href", "/entrar");
  for (const t of [/Guia de componentes/i, /Ver uma festa de exemplo/i, /revelação em 2 minutos/i]) await expect(page.getByText(t)).toHaveCount(0);
  await page.getByRole("link", { name: "Experimente a câmera agora" }).click();
  await page.waitForURL(/\/exemplo$/);
  await expect(page.getByTestId("selo-exemplo")).toHaveText("Exemplo · nada é salvo");
  await expect(page.getByRole("heading", { name: "Lu faz 40", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agora", level: 2 })).toBeVisible();
  await expect(page.getByAltText(/Foto de exemplo de/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
});

test("/ajuda é pública, tem h1, perguntas, contato único e links para Termos e Privacidade", async ({ page }) => {
  await page.goto("/ajuda");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
  for (const q of ["Como funciona?", "Câmera ou galeria?", "Quando as fotos aparecem?", "Privacidade e guarda das fotos", "Como funciona o pagamento?"]) await expect(page.getByRole("heading", { name: q, level: 2 })).toBeVisible();
  await expect(page.getByText(/O evento nasce grátis, até 10 convidados\./)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "mazinhoww@gmail.com" })).toHaveAttribute("href", "mailto:mazinhoww@gmail.com");
  await expect(page.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
  await expect(page.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test("remover foto e momento pedem confirmação; só removem depois de confirmar", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada", title: "Confirma" });
  await postViaFile(page, code);
  await page.goto(`/painel/${id}/conteudo`);
  await page.getByRole("tab", { name: /Todas/ }).click();
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "Remover esta foto?" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText("Os convidados deixam de vê-la.")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dlg.getByRole("button", { name: "Cancelar" }).click();
  await expect(dlg).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remover", exact: true })).toBeFocused();
  await expect(page.getByText("Ainda sem fotos.")).toHaveCount(0);
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.getByText("Ainda sem fotos.")).toBeVisible();

  await page.goto(`/painel/${id}/momentos`);
  const chip = page.getByRole("button", { name: "Remover O sim" });
  await chip.click();
  const md = page.getByRole("dialog", { name: "Remover momento O sim?" });
  await expect(md).toBeVisible();
  await md.getByRole("button", { name: "Cancelar" }).click();
  await expect(chip).toBeVisible();
  await chip.click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover", exact: true }).click();
  await expect(chip).toHaveCount(0);
});

test("card A6 do QR traz a copy nova e a linha de fotos e revelação", async ({ page }) => {
  const { id } = await createViaWizard(page, { reveal: "desligada", title: "Cards", shots: "10" });
  await page.goto(`/painel/${id}/qr`);
  await expect(page.getByText("Queremos a festa pelos seus olhos.").first()).toBeVisible();
  await expect(page.getByText("Aponte a câmera. Sem baixar app.").first()).toBeVisible();
  await expect(page.getByText("Cada um tem 10 fotos. Revelamos na hora.").first()).toBeVisible();
});

test("painel mostra exatamente um h1 em cada tela", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Um h1" });
  for (const s of ["", "/conteudo", "/convidados", "/momentos", "/qr", "/aparencia", "/configuracoes", "/downloads"]) {
    await page.goto(`/painel/${id}${s}`);
    await page.locator("h1").first().waitFor();
    await expect(page.locator("h1"), s || "/").toHaveCount(1);
  }
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
  await expect(page.getByRole("link", { name: "Ir para meus eventos" })).toHaveAttribute("href", "/eventos");
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
  await page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: "5", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvo." })).toBeVisible();
});

// ---- Task 14 (restante): preços, rodapé, painel com plano, configurações. Modo local: o catálogo só tem o Grátis.

test("home mostra a linha de preço só do Grátis quando não há plano pago ativo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("linha-preco")).toHaveText("Grátis até 10 convidados.");
});

test("/precos local mostra só o Grátis, Fale com a gente, h1, CTA e as 3 perguntas", async ({ page }) => {
  await page.goto("/precos");
  await expect(page.getByRole("heading", { level: 1, name: "Um preço por festa. Sem assinatura." })).toBeVisible();
  await expect(page.getByText("Comece grátis. Só pague se a festa passar de 10 convidados.")).toBeVisible();
  await expect(page.getByTestId("preco-gratis")).toBeVisible();
  await expect(page.locator('[data-testid^="preco-"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Fale com a gente" })).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
  for (const q of ["Como pago?", "E se passar do limite?", "Posso pedir reembolso?"]) await expect(page.getByRole("heading", { level: 2, name: q })).toBeVisible();
  await expect(page.getByText(/7 dias/)).toHaveCount(0);
});

test("rodapé tem Termos, Privacidade, Ajuda e a assinatura nas rotas públicas, e não aparece no painel nem no convite", async ({ page }) => {
  for (const route of ["/", "/precos", "/ajuda"]) {
    await page.goto(route);
    const rodape = page.getByRole("contentinfo");
    await expect(rodape.getByRole("link", { name: "Termos" })).toHaveAttribute("href", "/termos");
    await expect(rodape.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
    await expect(rodape.getByRole("link", { name: "Ajuda" })).toHaveAttribute("href", "/ajuda");
    await expect(rodape.getByText("MemoriesMT")).toBeVisible();
    await expect(rodape.getByText(/CNPJ/)).toHaveCount(0); // só aparece quando preenchido
  }
  const { code, id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}`);
  await page.locator("h1").first().waitFor();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await page.goto(`/e/${code}`);
  await page.locator("h1").first().waitFor();
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
});

test("painel mostra o cartão Plano, o checklist 'Antes do grande dia' e links certos", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Painel plano" });
  await page.goto(`/painel/${id}`);
  const plano = page.getByTestId("cartao-plano");
  await expect(plano).toContainText("Grátis");
  await expect(plano).toContainText("de 10 convidados");
  const check = page.getByTestId("checklist");
  await expect(check.getByRole("heading", { name: "Antes do grande dia" })).toBeVisible();
  await expect(check.getByText("Evento criado")).toBeVisible();
  await expect(check.getByRole("link", { name: /Tire a primeira foto como convidado/ })).toHaveAttribute("href", `/e/${code}`);
  await expect(check.getByRole("link", { name: /Imprima os cards/ })).toHaveAttribute("href", `/painel/${id}/qr`);
  await expect(check.getByText(/Pague o plano/)).toHaveCount(0);
});

test("configurações não oferece capacidade nem fotos acima do plano e leva a 'Aumentar plano'", async ({ page }) => {
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/configuracoes`);
  const cap = page.getByRole("group", { name: "Convidados" });
  await expect(cap.getByRole("button")).toHaveText(["5", "10"]);
  const fotos = page.getByRole("group", { name: "Fotos por pessoa" });
  await expect(fotos.getByRole("button")).toHaveText(["5", "10"]);
  await expect(page.getByTestId("limite-plano")).toContainText("Seu plano permite até 10 convidados e 10 fotos por pessoa.");
  await expect(page.getByRole("link", { name: "Aumentar plano" })).toHaveAttribute("href", `/painel/${id}/plano`);
});

test("configurações: o anfitrião edita 'Seu nome (aparece no convite)' e o valor persiste", async ({ page }) => {
  const { id } = await createViaWizard(page, { host: "Emy" });
  await page.goto(`/painel/${id}/configuracoes`);
  const campo = page.getByLabel("Seu nome (aparece no convite)");
  await expect(campo).toHaveValue("Emy");
  await campo.fill("Emy e Igor");
  await page.getByRole("button", { name: "Salvar seu nome" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvo." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Seu nome (aparece no convite)")).toHaveValue("Emy e Igor");
});

test("configurações: 'Tenho um código' abre a folha de código de presente", async ({ page }) => {
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Tenho um código" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Código de presente" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Código" })).toBeVisible();
});

test("link /c/<código> guarda o código, abre /criar e o passo 4 mostra o código", async ({ page }) => {
  await page.goto("/c/mmt-7kq4-ab12");
  await page.waitForURL(/\/criar$/);
  await seedHost(page, "Emy");
  await page.getByLabel("Nome que os convidados vão ver").fill("Festa do código");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Código MMT-7KQ4-AB12 será aplicado ao criar.")).toBeVisible();
});
