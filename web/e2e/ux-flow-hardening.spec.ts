import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { acceptTerms, createViaWizard, openInviteAsGuest, seedHost } from "./helpers";

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
  await expect(page.getByRole("heading", { name: "Você tem uma foto não enviada." })).toBeVisible();
}

async function changeKnownPerson(page: Page, code: string, name: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.getByRole("button", { name, exact: true }).click();
}

test("Outra data vazia é rejeitada e a duração padrão continua recuperável", async ({ page }) => {
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await page.getByLabel("Nome que os convidados vão ver").fill("Data explícita");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Outra data", exact: true }).click();
  const date = page.getByLabel("Escolha o horário");
  await expect(date).toHaveValue("");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Quando a festa acaba?" })).toBeVisible();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ has: date })).toContainText(/data e.*horário/);
  await page.getByRole("group", { name: "Termina em" }).getByRole("button", { name: "6 horas", exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Passo 3 de 4")).toBeVisible();
  expect(await localPhotos(page)).toEqual([]);
});

test("nome vazio no convite explica o erro e permite entrar na segunda tentativa", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await openInviteAsGuest(page, code);
  await acceptTerms(page);
  const name = page.getByLabel("Como te chamam na festa?");
  await name.fill("   ");
  const enter = page.getByRole("button", { name: "Entrar e abrir a câmera" });
  await enter.click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Escreva como te chamam na festa.", { exact: true })).toBeVisible();
  await expect(enter).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await name.fill("Ana");
  await enter.click();
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
  // Three real Next links leave /voce behind and /agora ahead of /postar.
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("link", { name: "Postar daqui", exact: true }).click();
  await expect(page.getByLabel("Escolher foto do aparelho")).toBeAttached();
  await page.getByRole("link", { name: "Agora", exact: true }).click();
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
    const destination = direction === "forward" ? "agora" : "voce";
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
    await expect(page).toHaveURL(new RegExp(`/e/${code}/${destination}$`));
    if (direction === "forward") {
      await page.goBack();
      await expect(page.getByRole("button", { name: "Retomar foto" })).toBeVisible();
      await page.getByRole("button", { name: "Retomar foto" }).click();
    }
  }
  expect(await localDrafts(page)).toEqual([draft]);
  expect(await localPhotos(page)).toEqual([]);
});

test("confirmação contém o foco também enquanto a gravação local está pendente", async ({ page }) => {
  const { id } = await createViaWizard(page);
  await page.goto(`/painel/${id}/momentos`);
  const trigger = page.getByRole("button", { name: "Remover O sim", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Remover momento O sim?" });
  const cancel = dialog.getByRole("button", { name: "Cancelar", exact: true });
  const confirm = dialog.getByRole("button", { name: "Remover", exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();

  // Hold a genuine IndexedDB transaction so the real UI action stays pending.
  // No app promise or repository method is replaced.
  await page.evaluate((eventId) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("memoriesmt");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("events", "readwrite");
      const store = tx.objectStore("events");
      let held = true;
      (window as Window & { __releaseUxEventLock?: () => void }).__releaseUxEventLock = () => { held = false; };
      const keepOpen = () => {
        const get = store.get(eventId);
        get.onsuccess = () => { if (held) keepOpen(); };
      };
      tx.oncomplete = () => db.close();
      tx.onerror = () => { db.close(); reject(tx.error); };
      keepOpen();
      resolve();
    };
  }), id);
  try {
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Escape");
    await page.mouse.click(1, 1);
    await expect(dialog).toBeVisible();
  } finally {
    await page.evaluate(() => (window as Window & { __releaseUxEventLock?: () => void }).__releaseUxEventLock?.());
  }
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Momentos", exact: true })).toBeVisible();
  await expect(trigger).toHaveCount(0);
});

test("bloqueio persiste após recarregar e recusa a mesma identidade sem apagar suas fotos", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada" });
  await openInviteAsGuest(page, code);
  await page.getByLabel("Como te chamam na festa?").fill("Ana");
  await acceptTerms(page);
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/postar$`));
  await choosePhoto(page, "História preservada depois do bloqueio");
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();
  const photos = await localPhotos(page);
  expect(photos).toHaveLength(1);
  expect(photos[0].uploadStatus).toBe("pronta");

  await changeKnownPerson(page, code, "Emy");
  await expect(page.getByRole("heading", { name: "Você está dentro, Emy." })).toBeVisible();
  await page.goto(`/painel/${id}/convidados`);
  await page.getByRole("button", { name: "Bloquear", exact: true }).click();
  await page.getByRole("dialog", { name: "Bloquear Ana?" }).getByRole("button", { name: "Bloquear acesso", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desbloquear", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Desbloquear", exact: true })).toBeVisible();
  const blocked = await localParticipant(page, id, photos[0].authorId);
  expect(blocked.name).toBe("Ana");
  expect(blocked.blockedAt).toEqual(expect.any(Number));

  await changeKnownPerson(page, code, "Ana");
  const name = page.getByLabel("Como te chamam na festa?");
  await expect(name).toHaveValue("Ana");
  await acceptTerms(page);
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await expect(page.getByText("Sua participação foi bloqueada pelo anfitrião. Fale com quem convidou você.", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await page.goto(`/e/${code}/postar`);
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await expect(page.getByLabel("Escolher foto do aparelho")).toHaveCount(0);
  expect(await localParticipant(page, id, photos[0].authorId)).toEqual(blocked);
  expect(await localPhotos(page)).toEqual(photos);
});
