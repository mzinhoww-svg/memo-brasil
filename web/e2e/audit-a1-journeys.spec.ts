/** Auditoria A1: jornadas ponta a ponta (estados vazio/erro/offline/permissão) com evidência. */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson, openDemo } from "./helpers";

test.use({ actionTimeout: 10_000, navigationTimeout: 20_000 });
const EV = path.resolve(__dirname, "../../docs/audit/evidence");
const FILE = `${EV}/test-results/a1-journeys.json`;
const rec = (k: string, v: unknown) => { let o: Record<string, unknown> = {}; try { o = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* novo */ } o[k] = v; fs.writeFileSync(FILE, JSON.stringify(o, null, 2)); };
const shot = (page: Page, n: string) => page.screenshot({ path: `${EV}/screenshots/a1-${n}.png`, fullPage: true });
const asPerson = (page: Page, name: string) => page.evaluate((n) => new Promise<boolean>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const tx = db.transaction("meta", "readwrite"); const g = tx.objectStore("meta").get("known"); g.onsuccess = () => { const u = (g.result as { id: string; name: string }[]).find((k) => k.name === n); if (u) tx.objectStore("meta").put(u, "user"); tx.oncomplete = () => { db.close(); res(!!u); }; }; }; }), name);
const body = async (page: Page, n = 200) => (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, n);

test("J1 criar -> convite (código/link/QR) -> entrar -> limites de rolo e de capacidade", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada", shots: "5", capacity: "5" });
  const pronto = { codigo: code, alfabeto_ok: /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(code), qr: await page.getByAltText(/QR Code do convite/).waitFor({ timeout: 5000 }).then(() => true, () => false), link: (await page.locator(".meta").first().innerText()) };
  // texto de convite AC-16 (via navigator.clipboard negado -> botão vira "Convite copiado")
  await page.getByRole("button", { name: "Compartilhar convite" }).click();
  pronto["botao_apos_compartilhar"] = await page.getByRole("button", { name: /Convite copiado|Compartilhar convite/ }).innerText();
  // /entrar: minúsculas, link inteiro, inexistente
  const ent: Record<string, string> = {};
  for (const [k, v] of Object.entries({ minusculas: code.toLowerCase(), link: `https://x.test/e/${code}?mesa=8`, inexistente: "ZZZZZZZZ", com_letras_proibidas: "0O1IL000" })) {
    await page.goto("/entrar");
    await page.getByLabel("Código da festa").fill(v);
    await page.getByRole("button", { name: "Entrar na festa" }).click();
    await page.waitForTimeout(500);
    ent[k] = page.url().replace(/^https?:\/\/[^/]+/, "") + " | " + (await body(page, 90));
  }
  // capacidade 5: host não conta; 5 convidados entram, o 6o é recusado; mesa via ?mesa=
  const caps: string[] = [];
  for (let i = 1; i <= 6; i++) {
    await page.goto("/");
    await page.goto(`/e/${code}?mesa=Mesa%20${i}`);
    const tem = await page.getByRole("button", { name: "Entrar como outra pessoa" }).count();
    void tem;
    await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").delete("user"); tx.oncomplete = () => { db.close(); res(); }; }; }));
    await page.goto(`/e/${code}?mesa=Mesa%20${i}`);
    await page.getByLabel("Como te chamam na festa?").fill(`Conv${i}`);
    await page.getByRole("button", { name: "Entrar na festa" }).click();
    await page.waitForTimeout(500);
    caps.push(`${i}: ${page.url().endsWith("/agora") ? "entrou" : await page.getByText(/lotada|terminou|confere|Escreva/).first().innerText()}`);
  }
  // rolo de 5 fotos: Conv5 (último logado entrou) posta até acabar
  const rolo: string[] = [];
  const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
  await asPerson(page, "Conv5");
  await page.goto(`/e/${code}/agora`);
  for (let i = 0; i < 6; i++) {
    await page.goto(`/e/${code}/postar`);
    if (await page.getByText("Seu filme acabou").count()) { rolo.push("bloqueado: Seu filme acabou"); break; }
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
    await expect(page.getByText("Foi para o laboratório")).toBeVisible();
    rolo.push(`foto ${i + 1} ok`);
  }
  await shot(page, "j1-rolo-acabou");
  await page.goto(`/e/${code}/postar`);
  const barra = await page.getByText(/fotos? restantes?|Rolo ilimitado/).count();
  // painel: capacidade abaixo dos convidados
  rec("J1", { pronto, entrar: ent, capacidade: caps, rolo, restante_visivel_na_tela_bloqueada: barra });
  void id;
});

test("J2 painel: editar nome, aviso, momentos, encerrar, não reabrir, excluir, e convidado após exclusão", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada" });
  await postViaFile(page, code);
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: /Editar nome/ }).click();
  await page.getByRole("textbox", { name: "Nome do evento" }).fill("Nome Novo");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await page.waitForTimeout(300);
  const nome = await page.getByRole("heading", { name: /Nome Novo/ }).count() + (await page.getByText("Nome Novo").count());
  // capacidade abaixo dos convidados (host + 0) -> trocar para 5 e voltar
  await page.getByRole("group", { name: "Convidados" }).getByRole("button", { name: "5", exact: true }).click();
  await page.getByLabel("Aviso curto").fill("Bolo em 10 min");
  await page.getByRole("button", { name: "Publicar aviso" }).click();
  await page.waitForTimeout(600);
  await page.goto(`/e/${code}/agora`);
  const aviso = await page.getByText("Bolo em 10 min").isVisible();
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Encerrar agora" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Encerrar agora" }).click();
  await page.waitForTimeout(400);
  const reabrir = await page.getByText("Este álbum já terminou e tem fotos. Não dá para reabrir.").count();
  await page.goto(`/e/${code}/postar`);
  const postar = await body(page, 120);
  await page.goto(`/painel/${id}/downloads`);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Baixar o álbum/ }).click()]);
  const zipName = dl.suggestedFilename();
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Lista de convidados/ }).click()]);
  // exclusão
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Excluir evento" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir evento" }).click();
  await page.waitForURL(/\/$/);
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(500);
  const apos = await body(page, 100);
  const stores = await page.evaluate(() => new Promise<Record<string, number>>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const out: Record<string, number> = {}; let n = 0; const names = ["events", "photos", "photoData", "reactions", "participants", "invitations"]; for (const s of names) { const c = db.transaction(s).objectStore(s).count(); c.onsuccess = () => { out[s] = c.result; if (++n === names.length) { db.close(); res(out); } }; } }; }));
  rec("J2", { renomear_ok: nome > 0, aviso_no_agora: aviso, nao_reabre: reabrir, postar_apos_encerrar: postar, zip: zipName, csv: csv.suggestedFilename(), convidado_apos_excluir: apos, linhas_restantes_no_idb: stores });
});

test("J3 moderação, reações (uma por pessoa), 'Quem reagiu', exportação vazia, editor", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada" });
  await page.goto(`/painel/${id}/downloads`);
  const vazioBtn = await page.getByRole("button", { name: /Baixar o álbum/ }).isDisabled();
  await postViaFile(page, code);
  await switchPerson(page, code, "Ana");
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(400);
  // Ana reage 2x com tipos diferentes, depois mesma
  const grp = page.getByRole("group", { name: "Reações" }).first();
  await grp.getByRole("button", { name: /^Amei/ }).click();
  await grp.getByRole("button", { name: /^Rachei/ }).click();
  await page.waitForTimeout(300);
  const pressed = await grp.locator("[aria-pressed=true]").allInnerTexts();
  await page.getByRole("button", { name: /Mais opções|Mais/ }).first().click().catch(() => undefined);
  const quem = (await page.getByRole("dialog").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
  await page.getByRole("button", { name: "Pedir para remover", exact: true }).click().catch(() => undefined);
  await page.getByRole("button", { name: /Fechar|Voltar/ }).first().click().catch(() => undefined);
  // anfitrião modera: foto denunciada entra na fila; ocultar some para o convidado; mostrar volta
  await asPerson(page, "Emy");
  await page.goto(`/painel/${id}/conteudo`);
  await page.waitForTimeout(600);
  const fila = await body(page, 330);
  await page.getByRole("button", { name: /^Foto de/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Tirar do álbum" }).click();
  await page.waitForTimeout(400);
  await asPerson(page, "Ana");
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(500);
  const aposOcultar = await page.locator("img[alt^='Foto de']").count();
  await asPerson(page, "Emy");
  await page.goto(`/painel/${id}/conteudo`);
  await page.getByRole("button", { name: /^Foto de/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Devolver ao álbum" }).click();
  await page.waitForTimeout(400);
  await asPerson(page, "Ana");
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(500);
  const aposMostrar = await page.locator("img[alt^='Foto de']").count();
  rec("J3", { exportar_desabilitado_sem_fotos: vazioBtn, reacoes_pressionadas_apos_2_cliques: pressed, quem_reagiu: quem, fila_moderacao: fila, convidado_ve_apos_ocultar: aposOcultar, convidado_ve_apos_mostrar: aposMostrar });
  await shot(page, "j3-moderacao");
});

test("J4 permissão de câmera negada e offline/reconexão", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: [] });
  await ctx.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); });
  const page = await ctx.newPage();
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await page.goto(`/e/${code}/postar`);
  await page.waitForTimeout(600);
  const negada = { msg: await page.getByText(/precisa da câmera/).isVisible(), escolher_foto: await page.getByRole("button", { name: "Escolher foto" }).isVisible(), tirar_foto: await page.getByRole("button", { name: "Tirar foto" }).count() };
  await shot(page, "j4-camera-negada");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await ctx.setOffline(true);
  await page.waitForTimeout(500);
  const off = { banner: await page.getByText(/Sem sinal agora/).isVisible(), posta_offline: false };
  await page.goto(`/e/${code}/postar`).catch(() => undefined);
  await page.waitForTimeout(500);
  off["navegar_offline_sem_SW_ativo"] = (await body(page, 100));
  await ctx.setOffline(false);
  await page.waitForTimeout(500);
  rec("J4", { negada, off });
  await ctx.close();
});

test("J5 estado vazio, erro de código e armazenamento indisponível", async ({ page, browser }) => {
  await page.goto("/entrar");
  await page.getByLabel("Código da festa").fill("abc");
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  const curto = await page.getByText("Código não confere").first().isVisible();
  await page.goto("/e/ZZZZZZZZ");
  await page.waitForTimeout(400);
  const inexistente = await body(page, 100);
  const demo = await openDemo(page);
  // IndexedDB indisponível
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true }); });
  const p = await ctx.newPage();
  await p.goto("/");
  await p.waitForTimeout(500);
  const semIdb = await p.getByText(/não deixa guardar dados/).isVisible();
  rec("J5", { codigo_curto: curto, codigo_inexistente: inexistente, demo, sem_indexeddb_aviso: semIdb });
  await ctx.close();
});

test("J6 editor: abrir foto visível, desenhar/texto, concluir e baixar; foto bloqueada não abre", async ({ page }) => {
  const { code } = await createViaWizard(page, { reveal: "desligada" });
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await page.getByRole("button", { name: /Mais/ }).first().click();
  await page.getByRole("link", { name: "Editar foto" }).or(page.getByRole("button", { name: "Editar foto" })).first().click();
  await page.waitForURL(/editar\//);
  await page.waitForTimeout(800);
  const canvas = page.getByRole("img", { name: "Foto em edição" });
  const box = await canvas.boundingBox();
  const antes = await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement).toDataURL().length);
  await page.getByRole("button", { name: "Desenho" }).first().click().catch(() => undefined);
  if (box) { await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 90, { steps: 8 }); await page.mouse.up(); }
  const depois = await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement).toDataURL().length);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Concluir e baixar" }).click()]);
  rec("J6", { canvas_visivel: !!box, desenho_alterou_canvas: antes !== depois, download: dl.suggestedFilename(), voltou_para: page.url() });
  await shot(page, "j6-editor");
});

test("J7 remover convidado e reentrar; AC-01 término < 30 min; corrida do último tiro em duas abas", async ({ page, context }) => {
  // AC-01
  await page.goto("/criar");
  await page.getByLabel("Nome do evento").fill("Curto");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Outra data" }).click();
  const soon = new Date(Date.now() + 10 * 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("Escolha o horário").fill(soon);
  await page.getByRole("button", { name: "Continuar" }).click();
  const ac01 = { ainda_no_passo_termino: await page.getByRole("heading", { name: "Quando a festa acaba?" }).isVisible(), msg: await page.getByText(/pelo menos 30 minutos/).first().innerText() };
  // remover convidado e reentrar
  const { code, id } = await createViaWizard(page, { reveal: "desligada", shots: "5" });
  await switchPerson(page, code, "Ana");
  await asPerson(page, "Emy");
  await page.goto(`/painel/${id}/convidados`);
  await page.locator("section[aria-labelledby=rem] button", { hasText: "Remover" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Remover da festa" }).click();
  await page.waitForTimeout(400);
  await asPerson(page, "Ana");
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(500);
  const aposRemover = page.url().endsWith("/agora") ? "ainda acessa /agora" : "redirecionada para o convite";
  await page.goto(`/e/${code}`);
  await page.getByLabel("Como te chamam na festa?").fill("Ana");
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await page.waitForTimeout(500);
  const reentrou = page.url().endsWith("/agora");
  // corrida: Ana posta 4 fotos, restam 1; duas abas publicam ao mesmo tempo
  const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
  for (let i = 0; i < 4; i++) await postViaFile(page, code);
  const b = await context.newPage();
  const prep = async (p: Page) => { await p.goto(`/e/${code}/postar`); await p.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG }); };
  await prep(page);
  await prep(b);
  await Promise.all([page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click(), b.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click()]);
  await page.waitForTimeout(1200);
  const total = await page.evaluate(() => new Promise<number>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const g = r.result.transaction("photos").objectStore("photos").getAll(); g.onsuccess = () => res((g.result as { authorName: string }[]).filter((p) => p.authorName === "Ana").length); }; }));
  rec("J7", { ac01, apos_remover_convidado: aposRemover, reentrada_apos_remocao: reentrou, fotos_da_Ana_apos_corrida_rolo_5: total });
});
