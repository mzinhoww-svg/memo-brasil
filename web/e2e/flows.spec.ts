import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { acceptTerms, createViaWizard, dateIn, denyCamera, openInviteAsGuest, postViaFile, switchPerson, weekdayOf } from "./helpers";

const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const TZ = "America/Cuiaba";

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
  const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
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
  await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
  await expect(page.getByText("Ainda sem fotos.")).toBeHidden();

  const after = Date.now() + 7 * 3_600_000; // evento dura 6 h
  await page.goto(`/e/${code}/agora?agora=${after}`);
  await expect(page.getByText("Visão de Ana")).toBeVisible();
  await expect(page.getByText("Encerrado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver a retrospectiva" })).toBeVisible();
  expect(id).toBeTruthy();
});

test("pedido de remoção cai na fila do anfitrião, que oculta e depois remove a foto", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada", title: "Moderação" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await switchPerson(page, code, "Beto");
  await page.goto(`/e/${code}/agora`);
  await page.getByRole("button", { name: /Mais opções/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Mais opções" })).toBeVisible();
  await page.getByRole("button", { name: "Pedir para remover", exact: true }).click();
  await expect(page.getByText("Pedido enviado. O anfitrião vai analisar.")).toBeVisible();
  await page.keyboard.press("Escape");

  // volta a ser o anfitrião pela própria interface ("Continuar como")
  await page.goto("/");
  await page.getByRole("button", { name: "Emy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Seus eventos" })).toBeVisible();
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
  const { code } = await createViaWizard(page, { reveal: "desligada" });
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


test("rota inexistente mostra 404 em português com saída", async ({ page }) => {
  const res = await page.goto("/pagina-que-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Essa página não existe." })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page.getByRole("heading", { name: "A festa vista por todo mundo." })).toBeVisible();
});

test("anfitrião testa como convidado e volta ao painel por 'Continuar como'", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Volta ao painel" });
  await switchPerson(page, code, "Ana");
  await page.goto(`/painel/${id}`);
  await expect(page.getByRole("heading", { name: "Só o anfitrião abre o painel." })).toBeVisible();
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.getByRole("button", { name: "Emy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Você está dentro, Emy." })).toBeVisible();
  await page.goto(`/painel/${id}`);
  await expect(page.getByRole("heading", { name: /por todos os ângulos/ })).toBeVisible();
});

test("cabeçalhos de segurança e CSP sem violações de console nas telas principais", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=(self)");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/agora/);
  await page.getByRole("link", { name: "Explorar" }).click();
  await page.getByRole("link", { name: "Você" }).click();
  expect(errors.filter((e) => /Content Security Policy|Refused to/i.test(e))).toEqual([]);
});


test.describe("jornada do convidado (Task 13)", () => {
  test("convite mostra fotos, revelação e quem vê", async ({ page }) => {
    const date = dateIn(TZ, 3);
    const { code } = await createViaWizard(page, { reveal: { date, time: "10:00", tz: TZ }, shots: "10" });
    await openInviteAsGuest(page, code);
    await expect(page.getByText("Você tem 10 fotos.")).toBeVisible();
    await expect(page.getByText("Escolha bem, como num filme.")).toBeVisible();
    await expect(page.getByText(`Revela ${weekdayOf(date)}, 10h.`)).toBeVisible();
    await expect(page.getByText("Até lá, só Emy pode ver.")).toBeVisible();
    await expect(page.getByText("Quem vê:")).toBeVisible();
    await expect(page.getByText("Emy e quem está na festa.")).toBeVisible();
    // o convite nunca aceita sem as duas caixas; o CTA leva direto à câmera
    await page.getByLabel("Como te chamam na festa?").fill("Ana");
    await acceptTerms(page);
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await page.waitForURL(new RegExp(`/e/${code}/postar$`));
  });

  test("convite com revelação desligada diz que as fotos aparecem na hora", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await expect(page.getByText("As fotos aparecem na hora.")).toBeVisible();
  });

  test("pré-permissão explica a câmera antes de pedir; negada, oferece galeria sem capture e posta foto", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await switchPerson(page, code, "Ana");
    await denyCamera(page);
    await page.goto(`/e/${code}/postar`);
    await expect(page.getByRole("heading", { name: "Libere a câmera" })).toBeVisible();
    await expect(page.getByText("Ela destrava suas 5 fotos")).toBeVisible();
    await expect(page.getByText(/Cada foto vai para o álbum da festa e aparece para todos na hora\./)).toBeVisible();
    await page.getByRole("button", { name: "Liberar câmera" }).click();

    await expect(page.getByText("Tudo bem, use a galeria.")).toBeVisible();
    await expect(page.getByTestId("ajuda-camera").getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("Permissões › Câmera › Permitir.")).toBeVisible(); // Chrome (o iPhone/Safari tem os próprios passos, cobertos em capture.test.ts)
    await expect(page.getByRole("button", { name: "Tentar a câmera de novo" })).toBeVisible();
    const gallery = page.getByLabel("Escolher foto do aparelho");
    await expect(gallery).not.toHaveAttribute("capture"); // UX-02: a galeria não abre a câmera
    await expect(page.getByLabel("Tirar foto com a câmera do aparelho")).toHaveAttribute("capture", "environment");

    await gallery.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Postar", exact: true }).click();
    await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();
  });

  test("pré-permissão: 'Prefiro escolher da galeria' vai direto para a galeria", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await switchPerson(page, code, "Ana");
    await denyCamera(page);
    await page.goto(`/e/${code}/postar`);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Prefiro escolher da galeria" }).click();
    expect((await chooser).isMultiple()).toBe(false);
  });

  test.describe("dentro do Instagram", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.0" });
    test("câmera negada orienta a abrir no navegador", async ({ page }) => {
      const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
      await switchPerson(page, code, "Ana");
      await denyCamera(page);
      await page.goto(`/e/${code}/postar`);
      await page.getByRole("button", { name: "Liberar câmera" }).click();
      await expect(page.getByText("Toque em ⋯ e escolha")).toBeVisible();
      await expect(page.getByText("Abrir no navegador")).toBeVisible();
    });
  });

  test("rede cai no envio: foto entra uma vez ao voltar, quota desconta 1", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await page.addInitScript(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { attach: 2 }; });
    await page.goto(`/e/${code}/postar`);
    await expect(page.getByText("5 fotos restantes")).toBeVisible();
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Postar", exact: true }).click();

    await expect(page.getByText("Sem sinal.", { exact: true })).toBeVisible();
    await expect(page.getByText("Não feche esta tela: sua foto vai assim que a internet voltar.")).toBeVisible();
    await expect(page.getByText(/Tentativa 1 de 3 · próxima em \d+ s/)).toBeVisible();
    await expect(page.getByText("5 fotos restantes")).toBeVisible(); // o contador só muda quando a foto chegar
    await expect(page.getByRole("button", { name: "Tentar agora" })).toBeVisible();
    await expect(page.getByText(/Verifique o espaço livre/)).toHaveCount(0);

    await expect(page.getByText("Sua visão entrou na história.")).toBeVisible({ timeout: 20_000 }); // 2 s + 5 s
    const ready = await page.evaluate(() => new Promise<number>((resolve) => {
      const q = indexedDB.open("memoriesmt");
      q.onsuccess = () => { const all = q.result.transaction("photos").objectStore("photos").getAll(); all.onsuccess = () => resolve(all.result.filter((p: { uploadStatus: string }) => p.uploadStatus === "pronta").length); };
    }));
    expect(ready).toBe(1);
    await page.goto(`/e/${code}/voce`);
    await expect(page.getByText("Restam 4 de 5")).toBeVisible();
  });

  test("'Tentar agora' reenvia sem esperar a contagem", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await page.addInitScript(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { attach: 2 }; });
    await page.goto(`/e/${code}/postar`);
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Postar", exact: true }).click();
    await expect(page.getByText(/Tentativa 2 de 3 · próxima em \d+ s/)).toBeVisible({ timeout: 10_000 }); // a 2ª falha abre a espera de 5 s
    await page.getByRole("button", { name: "Tentar agora" }).click();
    await expect(page.getByText("Sua visão entrou na história.")).toBeVisible({ timeout: 2500 }); // bem antes dos 5 s
  });

  test("join rate-limited mostra 'Muita gente entrando agora' e 'Tentar agora' entra na festa", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await page.evaluate(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { join: "rate-limited" }; });
    await page.getByLabel("Como te chamam na festa?").fill("Ana");
    await acceptTerms(page);
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await expect(page.getByRole("heading", { name: "Muita gente entrando agora." })).toBeVisible();
    await expect(page.getByText(/Tentamos de novo sozinhos em 30 segundos/)).toBeVisible();
    await expect(page.getByText("Nova tentativa em", { exact: true })).toBeVisible();
    await expect(page.getByTestId("nova-tentativa")).toHaveText(/^0:(30|29|28)$/);
    await expect(page.getByText("Código não confere.")).toHaveCount(0);
    await page.getByRole("button", { name: "Tentar agora" }).click();
    await page.waitForURL(new RegExp(`/e/${code}/postar$`));
  });

  test("join rate-limited tenta de novo sozinho em 30 segundos", async ({ page }) => {
    await page.clock.install();
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await page.evaluate(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { join: "rate-limited" }; });
    await page.getByLabel("Como te chamam na festa?").fill("Ana");
    await acceptTerms(page);
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await expect(page.getByRole("heading", { name: "Muita gente entrando agora." })).toBeVisible();
    await page.clock.fastForward(31_000);
    await page.waitForURL(new RegExp(`/e/${code}/postar$`));
  });

  test("join recusado pelo servidor mostra convite inativo, sem 'código não confere'", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await page.evaluate(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { join: "forbidden" }; });
    await page.getByLabel("Como te chamam na festa?").fill("Ana");
    await acceptTerms(page);
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await expect(page.getByRole("heading", { name: "Este convite não está mais ativo." })).toBeVisible();
    await expect(page.getByText("Fale com quem convidou você. Pode ser que a festa tenha um link novo.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tenho outro código" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Conhecer o MemoriesMT" })).toBeVisible();
  });

  test("espera: título e 'a noite fica para a pista' quando a revelação é no dia seguinte", async ({ page }) => {
    const date = dateIn(TZ, 1);
    const { code } = await createViaWizard(page, { reveal: { date, time: "10:00", tz: TZ }, shots: "5" });
    await switchPerson(page, code, "Ana");
    await expect(page.getByRole("heading", { name: "O filme ainda está no escuro." })).toBeVisible();
    await expect(page.getByText(`Revelamos ${weekdayOf(date)} às 10h. A noite fica para a pista.`)).toBeVisible();
  });

  test("pós-revelação: convite para criar o próprio evento, dispensável e uma vez só", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await switchPerson(page, code, "Ana");
    await expect(page.getByText("Tem uma festa vindo aí?")).toBeVisible();
    await expect(page.getByText("Faça a sua do mesmo jeito. Até 10 convidados é grátis.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar o meu evento" })).toHaveAttribute("href", "/");
    await page.getByRole("button", { name: "Dispensar convite para criar evento" }).click();
    await expect(page.getByText("Tem uma festa vindo aí?")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();
    await expect(page.getByText("Tem uma festa vindo aí?")).toHaveCount(0);
  });
});
