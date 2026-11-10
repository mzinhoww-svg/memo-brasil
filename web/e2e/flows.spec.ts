import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { acceptTerms, createViaWizard, enterAsGuest, seedHost, dateIn, denyCamera, openInviteAsGuest, postViaFile, switchPerson, weekdayOf } from "./helpers";

const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const TZ = "America/Cuiaba";

test("anfitrião cria um evento pelo wizard e vê o convite com código e QR", async ({ page }) => {
  const { code } = await createViaWizard(page);
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  // 15 · "A câmera de ... está pronta": o QR agora fica numa tela própria, aberta por "Baixar QR code"
  await expect(page.getByRole("heading", { level: 1, name: /A câmera de Emy e Igor\s*está pronta/ })).toBeVisible();
  await expect(page.getByAltText("Câmera do evento pronta")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compartilhar convite" })).toBeVisible();
  await expect(page.getByLabel("Link do convite")).toHaveValue(new RegExp(`/e/${code}$`));
  await page.getByRole("link", { name: "Baixar QR code" }).click();
  await page.waitForURL(/\/painel\/[^/]+\/qr$/);
});

test("wizard valida nome do evento e término curto, com mensagens que dizem o que fazer", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await next(); // 1 embalagem
  await next(); // 2 nome vazio: não avança
  await expect(page.getByText("Escolha o nome do evento. Todos os convidados vão ver.")).toBeVisible();
  await page.getByLabel("Nome do evento").fill("Festa");
  await next();
  await expect(page.getByRole("heading", { name: "Quando é a festa?" })).toBeVisible();
  // término daqui a 10 minutos (horário do aparelho): curto demais
  const soon = await page.evaluate(() => { const d = new Date(Date.now() + 10 * 60_000); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; });
  await page.getByLabel("Começa").fill("00:00");
  await page.getByLabel("Termina").fill(soon);
  await next();
  await expect(page.getByText("Escolha um horário no futuro, pelo menos 30 minutos a partir de agora.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quando é a festa?" })).toBeVisible();
});

test("cria evento grátis pelos 8 passos e chega em 'A câmera está pronta'", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await expect(page.getByText("1/8")).toBeVisible();
  await expect(page.getByLabel("Seu nome")).toHaveCount(0); // o anfitrião vem da conta, não do assistente
  await next();

  await expect(page.getByRole("heading", { name: "Nome do evento" })).toBeVisible();
  await expect(page.getByText("2/8")).toBeVisible();
  const sugestoes = page.getByRole("group", { name: "Sugestões de nome" }).getByRole("button");
  await expect(sugestoes.first()).toBeVisible();
  await sugestoes.first().click();
  await expect(page.getByLabel("Nome do evento")).not.toHaveValue("");
  await next();

  await expect(page.getByRole("heading", { name: "Quando é a festa?" })).toBeVisible();
  await next();

  await expect(page.getByRole("heading", { name: "Quando revelar?" })).toBeVisible();
  for (const t of ["Quando a festa acabar", "No dia seguinte", "Um dia depois", "Escolher dia e hora"]) await expect(page.getByRole("button", { name: new RegExp(t) })).toBeVisible();
  await next();

  await expect(page.getByRole("heading", { name: "Quantas poses?" })).toBeVisible();
  await expect(page.locator(".rv-counter b")).toHaveText("10");
  await page.getByRole("button", { name: /^24/ }).click();
  await expect(page.locator(".rv-counter b")).toHaveText("24");
  await next();

  await expect(page.getByRole("heading", { name: "Qual filme?" })).toBeVisible();
  await next();
  await expect(page.getByRole("heading", { name: "Quem vê o quê" })).toBeVisible();
  await next();

  await expect(page.getByRole("heading", { name: "Escolha o plano" })).toBeVisible();
  // no modo local só existe o Grátis
  await expect(page.getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio", { name: /^Grátis/ })).toBeChecked();
  await expect(page.getByText(/paga com Pix ou cartão/)).toHaveCount(0);
  await page.getByRole("button", { name: "Criar câmera" }).click();
  await acceptTerms(page);
  await page.waitForURL(/\/criar\/pronto\//);
  await expect(page.getByRole("heading", { level: 1, name: /está pronta/ })).toBeVisible();
  // nasce no Grátis mesmo com 24 poses escolhidas no passo Poses
  const id = page.url().split("/").pop()!;
  await page.goto(`/painel/${id}/configuracoes`);
  await expect(page.getByRole("button", { name: /^Poses\b.*10 por pessoa/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Plano\b.*até 10 convidados/ })).toBeVisible();
});

test("nenhum texto 'demonstração' ou 'teria valor' no assistente", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  for (let i = 0; i < 8; i++) {
    const t = (await page.locator("main, body").first().innerText()).toLowerCase();
    expect(t).not.toContain("demonstração");
    expect(t).not.toContain("teria valor");
    if (i === 1) await page.getByLabel("Nome do evento").fill("Festa");
    if (i < 7) await next();
  }
  await expect(page.getByRole("heading", { name: "Escolha o plano" })).toBeVisible();
});

test("revelar no dia seguinte marca o aviso às 12h no fuso do evento", async ({ page }) => {
  const next = () => page.getByRole("button", { name: "Próximo" }).click();
  await page.goto("/criar");
  await seedHost(page, "Emy");
  await next();
  await page.getByLabel("Nome do evento").fill("Manhã");
  await next();
  await next(); // 3 quando é a festa
  await expect(page.getByRole("heading", { name: "Quando revelar?" })).toBeVisible();
  await page.getByRole("button", { name: /No dia seguinte/ }).click();
  await expect(page.getByText(/^Todo mundo recebe o aviso (no|na) .+, às 12:00\.$/)).toBeVisible();
});

test("código inválido mostra erro; código válido leva ao convite", async ({ page }) => {
  const { code } = await createViaWizard(page);
  await page.goto("/entrar");
  const field = page.getByLabel("Código do convite");
  const submit = page.getByRole("button", { name: "Entrar no evento" });
  await field.fill("ABC");
  await expect(submit).toHaveAttribute("aria-disabled", "true"); // incompleto: não envia
  await field.fill("NFVARBQX");
  await submit.click();
  await expect(page.getByText("Esse código não abre nenhuma festa. Confira as letras no convite.")).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(field).toHaveValue("");
  await field.fill(code);
  await page.getByRole("button", { name: "Entrar no evento" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
});

test("convidado entra, posta com a câmera de teste, gasta o rolo e reage uma vez por foto", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
  await switchPerson(page, code, "Ana");
  await expect(page.locator(".stories")).toBeVisible();

  await page.goto(`/e/${code}/postar`);
  await expect(page.locator(".rv-counter b")).toHaveText("5");
  await expect(page.getByRole("button", { name: "Tirar foto" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Tirar foto" }).click();
  // 22 · Disparo: a pose vai direto para o laboratório e o visor continua aberto, com uma pose a menos
  await expect(page.locator(".rv-counter b")).toHaveText("4", { timeout: 20_000 });

  await page.goto(`/e/${code}/agora`);
  const curtir = page.getByRole("button", { name: "Curtir" });
  await curtir.click();
  await expect(curtir).toHaveAttribute("aria-pressed", "true");
  // foto aberta (24f): a reação Amei está marcada; escolher Uau troca (uma reação por pessoa)
  await page.getByRole("button", { name: /Abrir a foto de/ }).click();
  const amei = page.getByRole("button", { name: /^Amei/ });
  await expect(amei).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Uau/ }).click();
  await expect(amei).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /^Uau/ })).toHaveAttribute("aria-pressed", "true");

  for (let i = 0; i < 4; i++) await postViaFile(page, code);
  await page.goto(`/e/${code}/postar`);
  await expect(page.getByRole("heading", { name: "Seu filme acabou" })).toBeVisible();
  await expect(page.getByText(/Suas 5 fotos (estão no laboratório|já estão no feed)/)).toBeVisible();
  await page.goto(`/e/${code}/voce`);
  await expect(page.getByText("5 de 5", { exact: true })).toBeVisible();
});

test("revelação: outras pessoas só veem depois do fim do evento (relógio de teste)", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { title: "Festa do tempo" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await switchPerson(page, code, "Beto");
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByText("NO LABORATÓRIO")).toBeVisible();
  await expect(page.getByText("Ainda sem fotos.")).toBeHidden();

  const after = Date.now() + 7 * 3_600_000; // evento dura 6 h
  await page.goto(`/e/${code}/agora?agora=${after}`);
  await expect(page.locator("article.post b", { hasText: /^Ana$/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver a retrospectiva" })).toBeVisible();
  expect(id).toBeTruthy();
});

test("pedido de remoção cai na fila do anfitrião, que oculta e depois remove a foto", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada", title: "Moderação" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await switchPerson(page, code, "Beto");
  await page.goto(`/e/${code}/agora`);
  await page.getByRole("button", { name: "Mais", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Mais opções" })).toBeVisible();
  await page.getByRole("button", { name: "Pedir para remover", exact: true }).click();
  const denuncia = page.getByRole("dialog", { name: "Denunciar esta foto" });
  await denuncia.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(denuncia.getByText("Denúncia enviada. O anfitrião vai analisar.")).toBeVisible();

  // volta a ser o anfitrião pela própria interface ("Continuar como")
  await page.goto("/");
  await page.getByRole("button", { name: "Emy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Emy", exact: true })).toBeHidden();
  await page.goto(`/painel/${id}/conteudo`);
  // moderação (17i): a foto denunciada aparece em "Fotos"; "Esconder" a tira do álbum
  await page.goto(`/painel/${id}/moderacao`);
  await expect(page.getByRole("button", { name: /^Fotos 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Esconder" }).click();
  await expect(page.getByText("Nenhuma foto denunciada.")).toBeVisible();
  // revisão (17c): a foto escondida aparece apagada; a folha da foto exclui de vez
  await page.goto(`/painel/${id}/conteudo`);
  await page.getByRole("button", { name: /^Foto de Ana/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir a foto" }).click();
  await page.getByRole("dialog", { name: "Excluir esta foto?" }).getByRole("button", { name: "Excluir foto" }).click();
  await expect(page.getByText("Ainda sem fotos.")).toBeVisible();
});

test("o app é só Noite: tema escuro fixo, sem alternador, igual após recarregar e nas telas internas", async ({ page }) => {
  // Revela 2.0 removeu o tema Dia e o botão "Mudar para o tema Noite" (ver docs/qa/E2E-RETIREMENTS.md)
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: /Mudar para o tema/ })).toHaveCount(0);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bg);
  await page.goto("/entrar");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bg);
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
  await page.getByRole("button", { name: "Encerrar o filme agora" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Encerrar agora" }).click();
  await expect(page.getByRole("button", { name: "Encerrar o filme agora" })).toBeHidden();
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir evento" }).click();
  await page.waitForURL(/\/excluir$/);
  const del = page.getByRole("button", { name: "Excluir para sempre" });
  await expect(del).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("Nome do evento").fill("Para excluir");
  await expect(del).not.toHaveAttribute("aria-disabled", "true");
  await del.click();
  await page.waitForURL("/eventos");
  await page.goto(`/e/${code}`);
  await expect(page.getByText("Esse código não abre nenhuma festa. Confira as letras no convite.")).toBeVisible();
});

test("downloads: baixa o álbum em ZIP e a lista de convidados em CSV", async ({ page }) => {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  const id = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
    const all: { id: string }[] = await new Promise((res) => { const r = db.transaction("events").objectStore("events").getAll(); r.onsuccess = () => res(r.result); });
    return all[0].id;
  });
  await page.goto(`/painel/${id}/downloads`);
  const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar" }).first().click()]);
  expect(zip.suggestedFilename()).toBe("revela-emy-e-igor.zip");
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar" }).nth(1).click()]);
  expect(csv.suggestedFilename()).toMatch(/convidados\.csv$/);
});

test("mais opções: quem reagiu, baixar foto e editor (filme, cortar, girar, data) com download", async ({ page }) => {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await page.getByRole("button", { name: "Mais", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Mais opções" });
  await expect(sheet.getByRole("heading", { name: "Quem reagiu" })).toBeVisible();
  await expect(sheet.locator("li").first()).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Baixar foto" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^revela-.*\.(svg|jpg|png)$/);

  await sheet.getByRole("link", { name: "Editar foto" }).click();
  await page.waitForURL(/\/editar\//);
  // editor 25: filmes, cortar, girar, data e baixar (desenho, texto, colagem e desfazer saíram no Revela 2.0)
  const foto = page.getByRole("img", { name: /^Foto de/ });
  await expect(foto).toBeVisible();
  const semFilme = page.getByRole("button", { name: "Sem filme" });
  await semFilme.click();
  await expect(semFilme).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Preto e branco" }).click();
  await expect(semFilme).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Preto e branco" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Girar" }).click();
  await expect(foto).toHaveCSS("transform", /matrix\(0, 1, -1, 0/); // 90 graus
  await page.getByRole("button", { name: "Cortar" }).click();
  await page.getByRole("button", { name: "Data" }).click();
  const [baixada] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar" }).click()]);
  expect(baixada.suggestedFilename()).toMatch(/^revela-editada-.*\.jpg$/);
  const [salva] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Salvar" }).click()]);
  expect(salva.suggestedFilename()).toMatch(/^revela-editada-.*\.jpg$/);
  await page.waitForURL(/agora$/);
});

test("avisos do evento: ativar pede permissão e confirma", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await page.getByRole("link", { name: "Você" }).click();
  const aviso = page.getByRole("switch", { name: /Avisar quando revelar/ });
  await expect(aviso).toHaveAttribute("aria-checked", "false");
  await aviso.click();
  await expect(aviso).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => Notification.permission)).toBe("granted");
});


test("rota inexistente mostra 404 em português com saída", async ({ page }) => {
  const res = await page.goto("/pagina-que-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Essa página não existe." })).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page.getByRole("heading", { name: /Cada convidado\s*é uma câmera\./ })).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 1, name: "Volta ao painel" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Convidados/ })).toBeVisible();
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
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await page.getByRole("link", { name: "Minhas" }).click();
  await page.getByRole("link", { name: "Você" }).click();
  expect(errors.filter((e) => /Content Security Policy|Refused to/i.test(e))).toEqual([]);
});


test.describe("jornada do convidado (Task 13)", () => {
  test("convite mostra as poses do convidado e leva direto à câmera depois dos aceites", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: { date: dateIn(TZ, 3), time: "10:00", tz: TZ }, shots: "10" });
    await openInviteAsGuest(page, code);
    await expect(page.getByRole("heading", { level: 1, name: "Emy e Igor" })).toBeVisible();
    await expect(page.getByText("poses suas")).toBeVisible();
    await expect(page.locator("main b").filter({ hasText: /^10$/ })).toBeVisible();
    await expect(page.getByText("Foi o que o anfitrião liberou para você. Ninguém vê as fotos antes da revelação.")).toBeVisible();
    // o convite nunca aceita sem as duas caixas; o CTA leva direto à câmera
    await enterAsGuest(page, "Ana");
    await page.waitForURL(new RegExp(`/e/${code}/postar$`));
  });

  test("convite de evento com 5 poses mostra 5 poses suas", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await expect(page.locator("main b").filter({ hasText: /^5$/ })).toBeVisible();
    await expect(page.getByText("poses suas")).toBeVisible();
  });

  test("pré-permissão explica a câmera antes de pedir; negada, oferece galeria sem capture e posta foto", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await switchPerson(page, code, "Ana");
    await denyCamera(page);
    await page.goto(`/e/${code}/postar`);
    await expect(page.getByRole("heading", { name: "Libere a câmera" })).toBeVisible();
    await expect(page.getByText("As 5 poses que o anfitrião liberou ficam guardadas até a revelação. Ninguém vê antes, nem você.")).toBeVisible();
    await page.getByRole("button", { name: "Liberar" }).click();

    await expect(page.getByRole("heading", { name: "Tudo bem, use a galeria" })).toBeVisible();
    await expect(page.getByTestId("ajuda-camera").getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("Permissões › Câmera › Permitir.")).toBeVisible(); // Chrome (o iPhone/Safari tem os próprios passos, cobertos em capture.test.ts)
    await expect(page.getByRole("button", { name: "Tentar a câmera de novo" })).toBeVisible();
    const gallery = page.getByLabel("Escolher foto do aparelho");
    await expect(gallery).not.toHaveAttribute("capture"); // UX-02: a galeria não abre a câmera
    await expect(page.getByLabel("Tirar foto com a câmera do aparelho")).toHaveAttribute("capture", "environment");

    await gallery.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
    await expect(page.getByText("Foi para o laboratório")).toBeVisible();
  });

  test("pré-permissão: 'Agora não' leva à galeria, que abre o seletor de fotos", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await switchPerson(page, code, "Ana");
    await denyCamera(page);
    await page.goto(`/e/${code}/postar`);
    await page.getByRole("button", { name: "Agora não" }).click(); // "Agora não" leva à tela da galeria
    await expect(page.getByRole("heading", { name: "Tudo bem, use a galeria" })).toBeVisible();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Escolher da galeria" }).click();
    await chooser; // o seletor abre (o rolo da câmera aceita várias fotos)
  });

  test.describe("dentro do Instagram", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.0" });
    test("câmera negada orienta a abrir no navegador", async ({ page }) => {
      const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
      await switchPerson(page, code, "Ana");
      await denyCamera(page);
      await page.goto(`/e/${code}/postar`);
      await page.getByRole("button", { name: "Liberar" }).click();
      await expect(page.getByText("Toque em ⋯ e escolha")).toBeVisible();
      await expect(page.getByText("Abrir no navegador")).toBeVisible();
    });
  });

  test("rede cai no envio: foto entra uma vez ao voltar, quota desconta 1", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await page.addInitScript(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { attach: 2 }; });
    await page.goto(`/e/${code}/postar`);
    await expect(page.locator(".rv-counter b")).toHaveText("5");
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();

    await expect(page.getByText("Sem sinal", { exact: true })).toBeVisible();
    await expect(page.getByText("Sua pose ainda não foi confirmada. Tente de novo com a mesma foto ou descarte.")).toBeVisible();
    await expect(page.getByText(/Tentativa 1 de 3 · próxima em \d+ s/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar agora" })).toBeVisible();
    await expect(page.getByText(/Verifique o espaço livre/)).toHaveCount(0);

    await expect(page.getByText("Foi para o laboratório")).toBeVisible({ timeout: 20_000 }); // 2 s + 5 s
    const ready = await page.evaluate(() => new Promise<number>((resolve) => {
      const q = indexedDB.open("memoriesmt");
      q.onsuccess = () => { const all = q.result.transaction("photos").objectStore("photos").getAll(); all.onsuccess = () => resolve(all.result.filter((p: { uploadStatus: string }) => p.uploadStatus === "pronta").length); };
    }));
    expect(ready).toBe(1);
    await page.goto(`/e/${code}/voce`);
    await expect(page.getByText("1 de 5", { exact: true })).toBeVisible();
  });

  test("'Tentar agora' reenvia sem esperar a contagem", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await page.addInitScript(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { attach: 2 }; });
    await page.goto(`/e/${code}/postar`);
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
    await expect(page.getByText(/Tentativa 2 de 3 · próxima em \d+ s/)).toBeVisible({ timeout: 10_000 }); // a 2ª falha abre a espera de 5 s
    await page.getByRole("button", { name: "Tentar agora" }).click();
    await expect(page.getByText("Foi para o laboratório")).toBeVisible({ timeout: 2500 }); // bem antes dos 5 s
  });

  test("join rate-limited mostra 'Muita gente entrando agora' e 'Tentar agora' entra na festa", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await page.evaluate(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { join: "rate-limited" }; });
    await enterAsGuest(page, "Ana");
    await expect(page.getByRole("heading", { name: "Muita gente entrando agora" })).toBeVisible();
    await expect(page.getByText(/Tentamos de novo sozinhos em 30 segundos/)).toBeVisible();
    await expect(page.getByRole("status")).toContainText("nova tentativa");
    await expect(page.getByRole("timer")).toHaveText(/^0:\d\d$/);
    await expect(page.getByText("Esse código não abre nenhuma festa.")).toHaveCount(0);
    await page.getByRole("button", { name: "Tentar agora" }).click();
    await page.waitForURL(new RegExp(`/e/${code}/postar$`));
  });

  test("join rate-limited tenta de novo sozinho em 30 segundos", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" }); // relógio falso só depois de criar: o assistente usa o relógio real
    await page.clock.install();
    await openInviteAsGuest(page, code);
    await page.evaluate(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { join: "rate-limited" }; });
    await enterAsGuest(page, "Ana");
    await expect(page.getByRole("heading", { name: "Muita gente entrando agora" })).toBeVisible();
    await page.clock.fastForward(31_000);
    await page.waitForURL(new RegExp(`/e/${code}/postar$`));
  });

  test("join recusado pelo servidor mostra convite inativo, sem 'código não confere'", async ({ page }) => {
    const { code } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
    await openInviteAsGuest(page, code);
    await page.evaluate(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { join: "forbidden" }; });
    await enterAsGuest(page, "Ana");
    await expect(page.getByRole("heading", { name: /Este convite\s*não vale mais/ })).toBeVisible();
    await expect(page.getByText("O link expirou ou foi trocado pelo anfitrião. Peça o QR novo para quem organizou a festa.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Digitar outro código" })).toBeVisible();
    await expect(page.getByText("Esse código não abre nenhuma festa.")).toHaveCount(0);
  });

  test("espera: 'no laboratório' com a contagem e o dia da revelação quando é no dia seguinte", async ({ page }) => {
    const date = dateIn(TZ, 1);
    const { code } = await createViaWizard(page, { reveal: { date, time: "10:00", tz: TZ }, shots: "5" });
    await switchPerson(page, code, "Ana");
    await expect(page.getByText("NO LABORATÓRIO")).toBeVisible();
    await expect(page.getByText("Ninguém vê antes. Nem quem tirou.")).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByText(`Revela ${weekdayOf(date)}, 10:00`)).toBeVisible();
    // números reais do evento (não os do desenho): ninguém postou ainda
    await expect(page.getByRole("heading", { level: 2, name: /^\d+ fotos? de \d+ convidados?$/ })).not.toHaveText(/418/);
    await expect(page.getByRole("heading", { level: 2, name: /^0 fotos de/ })).toBeVisible();
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
    await expect(page.locator(".stories")).toBeVisible();
    await expect(page.getByText("Tem uma festa vindo aí?")).toHaveCount(0);
  });
});
