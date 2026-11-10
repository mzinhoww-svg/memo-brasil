import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, enterAsGuest, openInviteAsGuest, seedHost } from "./helpers";

const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));

// Every fixture and mutation stays in the browser's local IndexedDB. Never let
// this suite reach an authentication, billing, or production backend.
test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === origin || ["data:", "blob:"].includes(url.protocol)
      ? route.continue()
      : route.abort("blockedbyclient");
  });
});

async function localPhotos(page: Page) {
  return page.evaluate(() => new Promise<{ id: string; authorId: string; caption: string; uploadStatus: string }[]>((resolve, reject) => {
    const request = indexedDB.open("memoriesmt");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("photos");
      const all = tx.objectStore("photos").getAll();
      all.onsuccess = () => resolve(all.result.map(({ id, authorId, caption, uploadStatus }) => ({ id, authorId, caption, uploadStatus })));
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}

async function localDrafts(page: Page) {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((db) => db.name === "mm-photo-drafts")) return [];
    return new Promise<{ photoId: string; caption: string; moment: string; attempted: boolean; bytes: number }[]>((resolve, reject) => {
      const request = indexedDB.open("mm-photo-drafts");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("drafts");
        const all = tx.objectStore("drafts").getAll();
        all.onsuccess = () => resolve(all.result.map((d) => ({ photoId: d.photoId, caption: d.caption, moment: d.moment, attempted: d.attempted, bytes: d.data.bytes.byteLength })));
        tx.oncomplete = () => db.close();
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });
}

async function localParticipant(page: Page, eventId: string, userId: string) {
  return page.evaluate(({ eventId, userId }) => new Promise<{ userId: string; name: string; blockedAt?: number; joinedAt: number }>((resolve, reject) => {
    const request = indexedDB.open("memoriesmt");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("participants");
      const get = tx.objectStore("participants").get([eventId, userId]);
      get.onsuccess = () => resolve(get.result);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { eventId, userId });
}

async function choosePhoto(page: Page, caption: string) {
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "festa.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Prévia da sua foto")).toBeVisible();
  await page.getByRole("group", { name: "Momento", exact: true }).getByRole("button").last().click();
  await page.getByLabel("Legenda (opcional)").fill(caption);
  await expect.poll(async () => (await localDrafts(page))[0]?.caption).toBe(caption);
}

async function reloadDraft(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Você tem uma pose não enviada" })).toBeVisible();
}

async function changeKnownPerson(page: Page, code: string, name: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.getByRole("button", { name, exact: true }).click();
}

test("Dia vazio é rejeitado e a janela padrão continua recuperável", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await next(); // embalagem
  await page.getByLabel("Nome do evento").fill("Data explícita");
  await next();
  await expect(page.getByRole("heading", { name: "Quando é a festa?" })).toBeVisible();
  const day = page.getByLabel("Dia", { exact: true });
  const valid = await day.inputValue();
  await day.fill("");
  await next();
  await expect(page.getByRole("heading", { name: "Quando é a festa?" })).toBeVisible();
  await expect(page.getByText("Escolha o dia e os horários da festa.")).toBeVisible();
  await day.fill(valid);
  await next();
  await expect(page.getByRole("heading", { name: "Quantas poses?" })).toBeVisible();
  expect(await localPhotos(page)).toEqual([]);
});

test("nome vazio no convite explica o erro e permite entrar na segunda tentativa", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await openInviteAsGuest(page, code);
  const name = page.getByLabel("Seu nome");
  await name.fill("   ");
  const enter = page.getByRole("button", { name: /Entrar e fotografar/ });
  await enter.click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Escreva como te chamam na festa.", { exact: true })).toBeVisible();
  await expect(enter).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await enterAsGuest(page, "Ana");
  await expect(page).toHaveURL(new RegExp(`/e/${code}/postar$`));
  await expect(page.getByLabel("Escolher foto do aparelho")).toBeAttached();
  expect(await localPhotos(page)).toEqual([]);
});

test("rascunho sobrevive à recarga e só retoma ou descarta por decisão explícita", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await page.goto(`/e/${code}/postar`);
  await choosePhoto(page, "Legenda que precisa sobreviver");
  const [draft] = await localDrafts(page);
  expect(draft.bytes).toBeGreaterThan(0);
  expect(draft.attempted).toBe(false);

  await reloadDraft(page);
  await expect(page.getByAltText("Prévia da sua foto")).toHaveCount(0);
  await expect(page.getByText("Retomar não envia automaticamente.", { exact: false })).toBeVisible();
  expect(await localPhotos(page)).toEqual([]);
  expect(await localDrafts(page)).toEqual([draft]);
  await page.getByRole("button", { name: "Retomar foto" }).click();
  await expect(page.getByAltText("Prévia da sua foto")).toBeVisible();
  await expect(page.getByLabel("Legenda (opcional)")).toHaveValue(draft.caption);
  await expect(page.getByRole("group", { name: "Momento", exact: true }).getByRole("button", { name: draft.moment, exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await localPhotos(page)).toEqual([]);

  await reloadDraft(page);
  await page.getByRole("button", { name: "Descartar foto", exact: true }).click();
  await expect(page.getByLabel("Escolher foto do aparelho")).toBeAttached();
  await expect.poll(() => localDrafts(page)).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("Escolher foto do aparelho")).toBeAttached();
  await expect(page.getByRole("button", { name: "Retomar foto" })).toHaveCount(0);
  expect(await localPhotos(page)).toEqual([]);
});

test("rascunho protege Voltar e Avançar sem perder as entradas reais do histórico", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  test.skip(!await page.evaluate(() => "navigation" in window), "A confirmação de travessia exige Navigation API; persistência é coberta separadamente.");
  // Dois links reais do Next deixam o convite para trás e /agora à frente de /postar.
  await page.goto(`/e/${code}`);
  await page.getByRole("link", { name: /Abrir câmera/ }).click();
  await expect(page.getByLabel("Escolher foto do aparelho")).toBeAttached();
  await page.getByRole("link", { name: "Fechar câmera", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/agora$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/postar$`));
  await choosePhoto(page, "A mesma foto em ambas as direções");
  const [draft] = await localDrafts(page);
  const traverse = (direction: "forward" | "back") => page.evaluate((d) => {
    const navigation = (window as unknown as { navigation: Record<"forward" | "back", () => { finished: Promise<unknown> }> }).navigation;
    // finished settles after cancellation; a second fire-and-forget history.go
    // in the same pending traversal can be ignored by Chromium.
    return navigation[d]().finished.then(() => "finished", (error: DOMException) => error.name);
  }, direction);

  for (const direction of ["forward", "back"] as const) {
    const destination = direction === "forward" ? "agora" : "";
    const rejected = page.waitForEvent("dialog", { timeout: 10_000 });
    const cancelTraversal = traverse(direction);
    const first = await rejected;
    expect(first.type()).toBe("confirm");
    await first.dismiss();
    expect(await cancelTraversal).toBe("AbortError");
    await expect(page).toHaveURL(new RegExp(`/e/${code}/postar$`));
    await expect(page.getByAltText("Prévia da sua foto")).toBeVisible();
    expect(await localDrafts(page)).toEqual([draft]);

    const accepted = page.waitForEvent("dialog", { timeout: 10_000 });
    const acceptTraversal = traverse(direction);
    await (await accepted).accept();
    expect(await acceptTraversal).toBe("finished");
    await expect(page).toHaveURL(new RegExp(`/e/${code}${destination ? `/${destination}` : ""}$`));
    if (direction === "forward") {
      await page.goBack();
      await expect(page.getByRole("button", { name: "Retomar foto" })).toBeVisible();
      await page.getByRole("button", { name: "Retomar foto" }).click();
    }
  }
  expect(await localDrafts(page)).toEqual([draft]);
  expect(await localPhotos(page)).toEqual([]);
});

test("confirmação contém o foco e remover momento só vale depois de salvar", async ({ page }) => {
  const { id } = await createViaWizard(page);
  await page.goto(`/painel/${id}/momentos`);
  // 17f: a linha do momento abre a folha de edição; "Remover momento" abre a confirmação
  const row = page.getByRole("button", { name: /O sim/ }).first();
  const openRemove = async () => { await row.click(); await page.getByRole("button", { name: "Remover momento", exact: true }).click(); };
  await openRemove();
  const dialog = page.getByRole("dialog", { name: "Remover momento O sim?" });
  const cancel = dialog.getByRole("button", { name: "Cancelar", exact: true });
  const confirm = dialog.getByRole("button", { name: "Remover momento", exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await openRemove();

  // 17f: remover só muda a lista na tela; a gravação acontece em "Salvar" (a trava durante a gravação vale para a folha de Salvar)
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /O sim/ })).toHaveCount(1); // não salvo: continua no evento
});

test("bloqueio persiste após recarregar e recusa a mesma identidade sem apagar suas fotos", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada" });
  await openInviteAsGuest(page, code);
  await enterAsGuest(page, "Ana");
  await expect(page).toHaveURL(new RegExp(`/e/${code}/postar$`));
  await choosePhoto(page, "História preservada depois do bloqueio");
  await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
  await expect(page.getByText("Foi para o laboratório")).toBeVisible();
  const photos = await localPhotos(page);
  expect(photos).toHaveLength(1);
  expect(photos[0].uploadStatus).toBe("pronta");

  await changeKnownPerson(page, code, "Emy");
  await expect(page.getByRole("heading", { name: "Você está dentro, Emy." })).toBeVisible();
  await page.goto(`/painel/${id}/convidados`);
  await page.getByRole("button", { name: /Ana/ }).first().click(); // 17b: a linha da pessoa abre a folha
  await page.getByRole("dialog", { name: "Bloquear Ana?" }).getByRole("button", { name: "Bloquear acesso", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Ana/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Desbloquear Ana?" })).toBeVisible();
  await page.keyboard.press("Escape");
  const blocked = await localParticipant(page, id, photos[0].authorId);
  expect(blocked.name).toBe("Ana");
  expect(blocked.blockedAt).toEqual(expect.any(Number));

  await changeKnownPerson(page, code, "Ana");
  await expect(page.getByLabel("Seu nome")).toHaveValue("Ana");
  await enterAsGuest(page, "Ana");
  await expect(page.getByText("Sua participação foi bloqueada pelo anfitrião. Fale com quem convidou você.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.goto(`/e/${code}/postar`);
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await expect(page.getByLabel("Escolher foto do aparelho")).toHaveCount(0);
  expect(await localParticipant(page, id, photos[0].authorId)).toEqual(blocked);
  expect(await localPhotos(page)).toEqual(photos);
});
