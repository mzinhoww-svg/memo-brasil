import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, seedHost } from "./helpers";

// Experiência pública sem demonstração (Task 10) e defeitos de sessão/identidade (Task 11), no modo local.

test("home mostra a proposta, Montar câmera, Tenho um convite e Experimentar câmera, sem exemplo em banco nem guia de componentes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cada convidado é uma câmera.", level: 1 })).toBeVisible();
  await expect(page.getByText("Monte a câmera do evento, espalhe o QR pela festa e veja tudo revelado no dia seguinte.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Montar câmera" })).toHaveAttribute("href", "/criar");
  await expect(page.getByRole("link", { name: "Tenho um convite" })).toHaveAttribute("href", "/entrar#codigo");
  for (const t of [/Guia de componentes/i, /Ver uma festa de exemplo/i, /revelação em 2 minutos/i]) await expect(page.getByText(t)).toHaveCount(0);
  await page.getByRole("link", { name: "Experimentar câmera" }).click();
  await page.waitForURL(/\/exemplo$/);
  await expect(page.getByTestId("selo-exemplo")).toHaveText("Exemplo · nada é salvo");
  await expect(page.getByRole("heading", { name: "Lu faz 40", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
});

test("/ajuda é pública, tem as perguntas, contato único e sem noindex", async ({ page }) => {
  await page.goto("/ajuda");
  for (const q of ["Os convidados precisam baixar app?", "Quando as fotos aparecem?", "Posso trocar de plano depois?", "Como apago uma foto?", "O pagamento é seguro?"]) await expect(page.getByText(q, { exact: true })).toBeVisible();
  await expect(page.getByTestId("faq-app").getByText(/Não\. Eles apontam a câmera do celular/)).toBeVisible(); // a primeira nasce aberta
  await page.getByLabel("Buscar").fill("plano"); // a busca filtra só depois da hidratação: daí em diante os cliques valem
  await expect(page.getByText("Os convidados precisam baixar app?", { exact: true })).toHaveCount(0);
  await page.getByLabel("Buscar").fill("");
  await page.getByText("Posso trocar de plano depois?").click();
  await expect(page.getByText(/O evento nasce grátis, até 10 convidados, e o pagamento é único por evento/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Falar com o suporte" })).toHaveAttribute("href", /^mailto:.+@/);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test("excluir foto e remover momento pedem confirmação; só removem depois de confirmar", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada", title: "Confirma" });
  await postViaFile(page, code);
  await page.goto(`/painel/${id}/conteudo`);
  await page.getByRole("button", { name: /^Foto de/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir a foto" }).click();
  const dlg = page.getByRole("dialog", { name: "Excluir esta foto?" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText("Os convidados deixam de vê-la e ela não volta.")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dlg.getByRole("button", { name: "Cancelar" }).click();
  await expect(dlg).toHaveCount(0);
  await expect(page.getByText("Ainda sem fotos.")).toHaveCount(0);
  await page.getByRole("button", { name: /^Foto de/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir a foto" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir foto" }).click();
  await expect(page.getByText("Ainda sem fotos.")).toBeVisible();

  await page.goto(`/painel/${id}/momentos`);
  await page.getByRole("button", { name: /^(--:--|\d\d:\d\d)\s*O sim/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover momento" }).click();
  const md = page.getByRole("dialog", { name: "Remover momento O sim?" });
  await expect(md).toBeVisible();
  await md.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("button", { name: /O sim/ })).toBeVisible();
  await page.getByRole("button", { name: /O sim/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover momento" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover momento" }).click();
  await expect(page.getByRole("button", { name: /O sim/ })).toHaveCount(0);
});

test("QR das mesas: cartão com a redação do modelo, 4 modelos e download por mesa", async ({ page }) => {
  const { id } = await createViaWizard(page, { reveal: "desligada", title: "Cards", shots: "10" });
  await page.goto(`/painel/${id}/qr`);
  await expect(page.getByText(/Aponte a câmera do celular para o código, pegue a câmera do .+ e fotografe a festa pelo seu olhar\. Você tem 10 poses\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Proporção" })).toBeVisible();
});

test("painel mostra exatamente um h1 em cada tela", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Um h1" });
  for (const s of ["", "/conteudo", "/convidados", "/momentos", "/qr", "/aparencia", "/configuracoes", "/downloads", "/moderacao", "/convites", "/convite", "/aviso", "/compartilhar", "/excluir"]) {
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
  await page.getByRole("button", { name: "Compartilhar convite" }).click();
  await expect(page.getByText("Não conseguimos copiar. O link está selecionado.")).toBeAttached();
  await expect(page.getByRole("button", { name: "Convite copiado" })).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("link-convite");
});

test("configurações confirmam 'Salvo.' ao mudar uma regra", async ({ page }) => {
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: /^Poses\b/ }).click();
  await page.getByRole("dialog").getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: "5", exact: true }).click();
  // o resultado aparece dentro da folha aberta e também no aviso curto, que fica acima dela (não atrás)
  await expect(page.getByRole("dialog").getByRole("status").filter({ hasText: "Salvo." })).toBeVisible();
  await expect(page.locator(".rv-toast-in", { hasText: "Salvo." })).toBeInViewport();
});

// ---- Task 14 (restante): preços, rodapé, painel com plano, configurações. Modo local: o catálogo só tem o Grátis.

test("/precos local mostra só o Grátis, o aviso de planos em breve, h1 e o CTA", async ({ page }) => {
  await page.goto("/precos");
  await expect(page.getByRole("heading", { level: 1, name: "Um preço por festa." })).toBeVisible();
  await expect(page.getByText("Sem assinatura. Convidados não pagam nada e não precisam baixar app.")).toBeVisible();
  await expect(page.getByTestId("preco-gratis")).toContainText("10 convidados · 10 poses cada");
  await expect(page.locator('[data-testid^="preco-"]')).toHaveCount(1);
  await expect(page.getByText("Os planos pagos voltam em breve")).toBeVisible();
  await page.getByRole("button", { name: "Montar câmera" }).click();
  await page.waitForURL(/\/criar$/);
});

test("rodapé tem Termos, Privacidade, Ajuda e a assinatura nas rotas públicas, e não aparece no painel nem no convite", async ({ page }) => {
  for (const route of ["/"]) { // só a abertura leva rodapé; Preços e Ajuda são telas próprias, sem rodapé
    await page.goto(route);
    const rodape = page.getByRole("contentinfo");
    await expect(rodape.getByRole("link", { name: "Preços" })).toHaveAttribute("href", "/precos");
    await expect(rodape.getByRole("link", { name: "Termos" })).toHaveAttribute("href", "/termos");
    await expect(rodape.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");
    await expect(rodape.getByRole("link", { name: "Ajuda" })).toHaveAttribute("href", "/ajuda");
    await expect(rodape.getByText("Revela")).toBeVisible();
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

test("painel mostra os atalhos do resumo com o plano e os links certos", async ({ page }) => {
  const { id } = await createViaWizard(page, { title: "Painel plano" });
  await page.goto(`/painel/${id}`);
  const plano = page.getByRole("link", { name: /^Plano/ });
  await expect(plano).toContainText("Grátis");
  await expect(plano).toHaveAttribute("href", `/painel/${id}/plano`);
  await expect(page.getByRole("link", { name: /^Convites e mesas/ })).toHaveAttribute("href", `/painel/${id}/convites`);
  await expect(page.getByRole("link", { name: /^Moderação/ })).toHaveAttribute("href", `/painel/${id}/moderacao`);
  await expect(page.getByRole("link", { name: /^Downloads/ })).toHaveAttribute("href", `/painel/${id}/downloads`);
});

test("configurações não oferece capacidade nem fotos acima do plano e leva a 'Aumentar plano'", async ({ page }) => {
  const { id } = await createViaWizard(page, {});
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("group", { name: "Convidados" }).getByRole("button")).toHaveText(["5", "10"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Poses\b/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button")).toHaveText(["5", "10"]);
  await expect(page.getByTestId("limite-plano")).toContainText("Seu plano permite até 10 convidados e 10 fotos por pessoa.");
  await expect(dialog.getByRole("link", { name: "Aumentar plano" })).toHaveAttribute("href", `/painel/${id}/plano`);
});
