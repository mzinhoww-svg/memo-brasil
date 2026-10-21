import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));

/** Cria um evento pelo wizard e devolve o código. Parâmetros avançam passo a passo pela UI real. */
async function createViaWizard(page: Page, opts: { title?: string; reveal?: RegExp | string; shots?: string; capacity?: string } = {}): Promise<{ code: string; id: string }> {
  await page.goto("/criar");
  await page.getByLabel("Nome do evento").fill(opts.title ?? "Emy e Igor");
  await page.getByLabel("Seu nome").fill("Emy");
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Próximo" }).click(); // término: 6 horas
  await page.getByRole("button", { name: opts.reveal ?? "Quando o evento terminar" }).click();
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Próximo" }).click(); // identidade
  if (opts.capacity) await page.getByRole("group", { name: "Convidados" }).getByRole("button", { name: opts.capacity, exact: true }).click();
  if (opts.shots) await page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: opts.shots, exact: true }).click();
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await page.waitForURL(/\/criar\/pronto\//);
  const code = (await page.getByTestId("codigo").textContent())!.trim();
  const id = page.url().split("/").pop()!;
  return { code, id };
}

async function postViaFile(page: Page, code: string, moment = "O sim") {
  await page.goto(`/e/${code}/postar`);
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: moment, exact: true }).click();
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();
}

async function switchPerson(page: Page, code: string, name: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
  await page.getByLabel("Como te chamam na festa?").fill(name);
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await page.waitForURL(/agora$/);
}

test("anfitrião cria um evento pelo wizard e vê o convite com código e QR", async ({ page }) => {
  const { code } = await createViaWizard(page);
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  await expect(page.getByAltText(/QR Code do convite/)).toBeVisible();
  await expect(page.getByText("Evento criado.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartilhar convite" })).toBeVisible();
});

test("wizard valida nome do evento e término curto, com mensagens que dizem o que fazer", async ({ page }) => {
  await page.goto("/criar");
  await page.getByRole("button", { name: "Próximo" }).click();
  await expect(page.getByText("Escolha o nome do evento. Todos os convidados vão ver.")).toBeVisible();
  await expect(page.getByText("Escreva seu nome para organizar a festa.")).toBeVisible();
  await page.getByLabel("Nome do evento").fill("Festa");
  await page.getByLabel("Seu nome").fill("Emy");
  await page.getByRole("button", { name: "Próximo" }).click();
  const soon = new Date(Date.now() + 10 * 60_000);
  const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("Ou escolha o horário").evaluate((el) => { (el as HTMLInputElement).removeAttribute("min"); });
  await page.getByLabel("Ou escolha o horário").fill(local);
  await page.getByRole("button", { name: "Próximo" }).click();
  await expect(page.getByText("Escolha um horário no futuro, pelo menos 30 minutos a partir de agora.")).toBeVisible();
});

test("código inválido mostra erro; código válido leva ao convite", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Código da festa").fill("ABC");
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await expect(page.getByText("Código não confere. Confira no card da mesa.")).toBeVisible();
  await expect(page.getByLabel("Código da festa")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Código da festa").fill("NFVARBQX");
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await page.waitForURL(/\/e\/NFVARBQX$/);
  await expect(page.getByRole("heading", { name: "Código não confere." })).toBeVisible(); // evento não existe neste aparelho
});

test("convidado entra, posta com a câmera de teste, gasta o rolo e reage uma vez por foto", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "Na hora, durante o evento", shots: "5" });
  await switchPerson(page, code, "Ana");
  await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();

  await page.goto(`/e/${code}/postar`);
  await expect(page.getByText("5 fotos restantes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tirar foto" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Tirar foto" }).click();
  await expect(page.getByAltText("Prévia da sua foto")).toBeVisible();
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();

  await page.goto(`/e/${code}/agora`);
  const amei = page.getByRole("button", { name: /^Amei/ });
  await amei.click();
  await expect(amei).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Uau/ }).click();
  await expect(amei).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Uau/ })).toHaveAttribute("aria-pressed", "true");

  for (let i = 0; i < 4; i++) await postViaFile(page, code);
  await page.goto(`/e/${code}/postar`);
  await expect(page.getByRole("heading", { name: "Seu rolo acabou." })).toBeVisible();
  await expect(page.getByText("Você usou todas as suas fotos deste evento.")).toBeVisible();
  await page.goto(`/e/${code}/voce`);
  await expect(page.getByText("Restam 0 de 5")).toBeVisible();
});

test("revelação: outras pessoas só veem depois do fim do evento (relógio de teste)", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Festa do tempo" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await switchPerson(page, code, "Beto");
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByText("Ainda sem fotos.")).toBeVisible();
  await expect(page.getByText(/As fotos dos outros aparecem quando o evento terminar/)).toBeVisible();

  const after = Date.now() + 7 * 3_600_000; // evento dura 6 h
  await page.goto(`/e/${code}/agora?agora=${after}`);
  await expect(page.getByText("Visão de Ana")).toBeVisible();
  await expect(page.getByText("Encerrado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver a retrospectiva" })).toBeVisible();
  expect(id).toBeTruthy();
});

test("pedido de remoção cai na fila do anfitrião, que oculta e depois remove a foto", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "Na hora, durante o evento", title: "Moderação" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await switchPerson(page, code, "Beto");
  await page.goto(`/e/${code}/agora`);
  await page.getByRole("button", { name: /Mais opções/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Mais opções" })).toBeVisible();
  await page.getByRole("button", { name: "Pedir para remover", exact: true }).click();
  await expect(page.getByText("Pedido enviado. O anfitrião vai analisar.")).toBeVisible();
  await page.keyboard.press("Escape");

  // volta a ser o anfitrião: o evento foi criado por Emy; troca de pessoa não restaura a identidade, então
  // o teste assume a identidade do anfitrião pelo mesmo registro local.
  await page.evaluate(async (eid) => {
    const open = (n: string) => new Promise<IDBDatabase>((res) => { const r = indexedDB.open(n); r.onsuccess = () => res(r.result); });
    const db = await open("memoriesmt");
    const ev: { hostId: string; hostName: string } = await new Promise((res) => { const r = db.transaction("events").objectStore("events").get(eid); r.onsuccess = () => res(r.result); });
    await new Promise((res) => { const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put({ id: ev.hostId, name: ev.hostName, createdAt: 1 }, "user"); tx.oncomplete = () => res(null); });
  }, id);
  await page.goto(`/painel/${id}/conteudo`);
  await expect(page.getByRole("tab", { name: "Pedidos de remoção · 1" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Ocultar" }).click();
  await page.getByRole("tab", { name: /Ocultas/ }).click();
  await expect(page.getByText("Visão de Ana")).toBeVisible();
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.getByText("Nenhuma foto oculta.")).toBeVisible();
});

test("tema Noite persiste ao recarregar e vale para o app inteiro", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dia");
  await page.getByRole("button", { name: "Mudar para o tema Noite" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "noite");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "noite");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(20, 18, 17)");
});

test("sem sinal: aviso na área do convidado e fotos continuam guardadas", async ({ page, context }) => {
  const { code } = await createViaWizard(page, { reveal: "Na hora, durante o evento" });
  await page.goto(`/e/${code}/agora`);
  await context.setOffline(true);
  await expect(page.getByText(/Sem sinal agora\. Suas \d+ fotos estão guardadas\./)).toBeVisible();
  await context.setOffline(false);
});

test("evento: encerrar agora e excluir, com confirmação", async ({ page }) => {
  const { id, code } = await createViaWizard(page, { title: "Para excluir" });
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Encerrar agora" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Encerrar agora" }).click();
  await expect(page.getByText(/Terminou em/)).toBeVisible();
  await page.getByRole("button", { name: "Excluir evento" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir evento?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir evento" }).click();
  await page.waitForURL("/");
  await page.goto(`/e/${code}`);
  await expect(page.getByRole("heading", { name: "Código não confere." })).toBeVisible();
});

test("downloads: baixa o álbum em ZIP e a lista de convidados em CSV", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/agora/);
  const id = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
    const all: { id: string }[] = await new Promise((res) => { const r = db.transaction("events").objectStore("events").getAll(); r.onsuccess = () => res(r.result); });
    return all[0].id;
  });
  await page.goto(`/painel/${id}/downloads`);
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar o álbum (ZIP)" }).click()]);
  expect(zip.suggestedFilename()).toBe("memoriesmt-emy-e-igor.zip");
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Lista de convidados (CSV)" }).click()]);
  expect(csv.suggestedFilename()).toMatch(/convidados\.csv$/);
});

test("mais opções: quem reagiu, baixar foto e editor (desenho, texto, colagem, desfazer) com download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/agora/);
  await page.getByRole("button", { name: /Mais opções/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "Mais opções" });
  await expect(sheet.getByRole("heading", { name: "Quem reagiu" })).toBeVisible();
  await expect(sheet.locator("li").first()).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Baixar foto" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^memoriesmt-.*\.(svg|jpg|png)$/);

  await sheet.getByRole("link", { name: "Editar foto" }).click();
  await page.waitForURL(/\/editar\//);
  const canvas = page.getByRole("img", { name: "Foto em edição" });
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const undo = page.getByRole("button", { name: "Desfazer" });
  await expect(undo).toBeDisabled();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await expect(undo).toBeEnabled();
  await page.getByRole("button", { name: "Texto", exact: true }).click();
  await page.getByLabel("Texto", { exact: true }).fill("Quem viu, viu.");
  await page.getByRole("button", { name: "Adicionar texto" }).click();
  await expect(page.getByRole("button", { name: "Excluir texto" })).toBeEnabled();
  await page.getByRole("button", { name: "Colagem" }).click();
  await page.getByRole("button", { name: "2 lado a lado" }).click();
  await expect(page.getByRole("button", { name: "2 lado a lado" })).toHaveAttribute("aria-pressed", "true");
  await undo.click();
  await expect(page.getByRole("button", { name: "2 lado a lado" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Refazer" })).toBeEnabled();
  const [edited] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Concluir e baixar" }).click()]);
  expect(edited.suggestedFilename()).toMatch(/^memoriesmt-editada-.*\.jpg$/);
  await page.waitForURL(/agora$/);
});

test("avisos do evento: ativar pede permissão e confirma", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/agora/);
  await page.getByRole("link", { name: "Você" }).click();
  await page.getByRole("button", { name: "Ativar avisos" }).click();
  await expect(page.getByText("Avisos ligados neste aparelho.")).toBeVisible();
});
