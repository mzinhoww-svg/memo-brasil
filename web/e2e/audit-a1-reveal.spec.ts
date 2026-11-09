/** Auditoria A1: revelação programada em profundidade (relógio controlado por page.clock). Evidência, não suíte de regressão. */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";
import { zonedToEpoch, epochToZoned, formatInZone, validateRevealInput, computeRevealStatus } from "../src/domain/reveal";

test.use({ actionTimeout: 10_000, navigationTimeout: 20_000 });
const EV = path.resolve(__dirname, "../../docs/audit/evidence");
const BASE = Date.parse("2026-11-10T15:00:00Z"); // 11:00 em Cuiabá
const REVEAL = BASE + 3_600_000; // 12:00 em Cuiabá
const FILE = `${EV}/test-results/a1-reveal.json`;
const rec = new Proxy({} as Record<string, unknown>, { set(_t, k: string, v) { let o: Record<string, unknown> = {}; try { o = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* novo */ } o[k] = v; fs.writeFileSync(FILE, JSON.stringify(o, null, 2)); return true; } });
const shot = (page: Page, n: string) => page.screenshot({ path: `${EV}/screenshots/a1-${n}.png`, fullPage: true });

const events = (page: Page) => page.evaluate(() => new Promise<Record<string, unknown>[]>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const g = db.transaction("events").objectStore("events").getAll(); g.onsuccess = () => { res(g.result); db.close(); }; }; }));
const asPerson = (page: Page, name: string) => page.evaluate((n) => new Promise<boolean>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const tx = db.transaction("meta", "readwrite"); const g = tx.objectStore("meta").get("known"); g.onsuccess = () => { const u = (g.result as { id: string; name: string }[]).find((k) => k.name === n); if (u) tx.objectStore("meta").put(u, "user"); tx.oncomplete = () => { db.close(); res(!!u); }; }; }; }), name);
const waiting = (page: Page) => page.getByTestId("aguardando-revelacao");

async function setup(page: Page, opts: { reveal?: Parameters<typeof createViaWizard>[1]["reveal"]; hostPhoto?: boolean } = {}) {
  await page.clock.install({ time: BASE });
  const { code, id } = await createViaWizard(page, { reveal: opts.reveal ?? { date: "2026-11-10", time: "12:00", tz: "America/Cuiaba" } });
  if (opts.hostPhoto !== false) await postViaFile(page, code);
  return { code, id };
}

test("R1 borda exata now===revealAt (setFixedTime + reload)", async ({ page }) => {
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  const out: Record<string, boolean> = {};
  for (const [k, t] of Object.entries({ "revealAt-1ms": REVEAL - 1, "revealAt": REVEAL, "revealAt+1ms": REVEAL + 1 })) {
    await page.clock.setFixedTime(t);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();
    await page.waitForTimeout(400);
    out[k] = await waiting(page).isVisible();
  }
  rec.R1_aguardando_visivel = out;
  await shot(page, "r1-borda");
  expect(out["revealAt-1ms"]).toBe(true);
  expect(out["revealAt"]).toBe(false);
  expect(out["revealAt+1ms"]).toBe(false);
});

test("R2 fusos e DST (domínio) + mesmo instante nas superfícies, com fuso do aparelho diferente", async ({ browser }) => {
  // domínio puro
  const lis = (d: string, t: string) => { const e = zonedToEpoch(d, t, "Europe/Lisbon"); return Number.isNaN(e) ? "NaN" : new Date(e).toISOString(); };
  rec.R2_dst = {
    "Lisboa 2026-10-25 00:59 (antes da volta)": lis("2026-10-25", "00:59"),
    "Lisboa 2026-10-25 01:30 (ambíguo: ocorre 2x)": lis("2026-10-25", "01:30"),
    "Lisboa 2026-10-25 02:00": lis("2026-10-25", "02:00"),
    "Lisboa 2026-03-29 00:59": lis("2026-03-29", "00:59"),
    "Lisboa 2026-03-29 01:30 (inexistente)": lis("2026-03-29", "01:30"),
    "Lisboa 2026-03-29 02:00": lis("2026-03-29", "02:00"),
    "UTC 2026-11-10 12:00": zonedToEpoch("2026-11-10", "12:00", "UTC") === Date.parse("2026-11-10T12:00:00Z"),
    "Cuiabá 2026-11-10 12:00": new Date(zonedToEpoch("2026-11-10", "12:00", "America/Cuiaba")).toISOString(),
    "São Paulo 2026-11-10 12:00 (sem DST desde 2019)": new Date(zonedToEpoch("2026-11-10", "12:00", "America/Sao_Paulo")).toISOString(),
    "roundtrip Lisboa 2026-10-25 01:30 -> epoch -> campos": epochToZoned(zonedToEpoch("2026-10-25", "01:30", "Europe/Lisbon"), "Europe/Lisbon"),
    "roundtrip Lisboa 2026-03-29 01:30 -> epoch -> campos": epochToZoned(zonedToEpoch("2026-03-29", "01:30", "Europe/Lisbon"), "Europe/Lisbon"),
  };
  // superfícies com o navegador em fuso totalmente diferente
  const ctx = await browser.newContext({ timezoneId: "Pacific/Auckland", permissions: ["camera"] });
  const page = await ctx.newPage();
  const { code, id } = await setup(page);
  const txt: Record<string, string> = {};
  await page.goto(`/painel/${id}`);
  txt.painel_resumo = (await page.getByTestId("resumo-revelacao").innerText()).replace(/\s+/g, " ");
  await page.goto(`/painel/${id}/configuracoes`);
  txt.config_resumo = (await page.getByTestId("config-revelacao").innerText()).replace(/\s+/g, " ").slice(0, 400);
  await page.getByRole("button", { name: "Pré-visualizar como convidado" }).click();
  txt.previa = (await page.getByTestId("aguardando-revelacao").innerText()).replace(/\s+/g, " ");
  await page.goto("/");
  await switchPerson(page, code, "Ana");
  txt.convidado = (await waiting(page).innerText()).replace(/\s+/g, " ");
  txt.contagem = await page.getByTestId("contagem").innerText();
  rec.R2_superficies = txt;
  rec.R2_esperado = formatInZone(REVEAL, "America/Cuiaba");
  await shot(page, "r2-fuso-auckland");
  for (const v of Object.values(txt).slice(0, 4)) if (v !== txt.contagem) expect(v).toContain("12h00");
  expect(txt.contagem).toMatch(/00h 5\d\s?min|00h 59min/);
  await ctx.close();
});

test("R3 validações: 31/02, hora, fuso, passado, +1 minuto (domínio) e UI", async ({ page }) => {
  const v = (d: string, t: string, tz: string, now = BASE) => JSON.stringify(validateRevealInput({ date: d, time: t, timezone: tz }, now));
  rec.R3_dominio = {
    "31/02": v("2026-02-31", "10:00", "UTC"), "30/02": v("2026-02-30", "10:00", "UTC"), "29/02/2027 (nao bissexto)": v("2027-02-29", "10:00", "UTC"), "29/02/2028": v("2028-02-29", "10:00", "UTC"),
    "hora 25:00": v("2026-11-11", "25:00", "UTC"), "hora 12:60": v("2026-11-11", "12:60", "UTC"), "hora vazia": v("2026-11-11", "", "UTC"), "data vazia": v("", "10:00", "UTC"),
    "fuso inventado": v("2026-11-11", "10:00", "Marte/Olimpo"), "fuso vazio": v("2026-11-11", "10:00", ""), "fuso offset 'UTC+3'": v("2026-11-11", "10:00", "UTC+3"),
    "passado": v("2026-11-10", "10:00", "UTC"), "agora+59,999s": JSON.stringify(validateRevealInput({ date: "2026-11-10", time: "15:01", timezone: "UTC" }, BASE + 1)), "agora+60s exato": v("2026-11-10", "15:01", "UTC"),
    "ano 0001": v("0001-01-01", "10:00", "UTC"), "ano 99999 (5 dígitos)": v("99999-01-01", "10:00", "UTC"), "ano 9999": v("9999-12-31", "23:59", "UTC"),
  };
  // UI: com Date.now fixo em BASE (11:00 Cuiabá)
  await page.clock.install({ time: BASE });
  await page.clock.setFixedTime(BASE);
  const ui: Record<string, string> = {};
  for (const [k, time] of Object.entries({ "11:00 (=agora)": "11:00", "11:01 (=+60s)": "11:01" })) {
    await page.goto("/criar");
    await page.getByLabel("Nome que os convidados vão ver").fill("Teste");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Escolher dia" }).click();
    await page.getByLabel("Data", { exact: true }).fill("2026-11-10");
    await page.getByLabel("Horário", { exact: true }).fill(time);
    await page.getByLabel("Fuso horário").selectOption("America/Cuiaba");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForTimeout(200);
    ui[k] = (await page.getByRole("heading", { level: 1 }).first().innerText()) + " | alerta: " + ((await page.getByText(/pelo menos 1 minuto|data e uma hora/).count()) ? "erro mostrado" : "sem erro");
  }
  // data vazia no modo data
  await page.goto("/criar");
  await page.getByLabel("Nome que os convidados vão ver").fill("Teste");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Escolher dia" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  ui["data/hora vazias"] = (await page.getByText(/data e uma hora válidas/).count()) ? "erro mostrado" : "SEM ERRO";
  await shot(page, "r3-validacao");
  rec.R3_ui = ui;
  expect(ui["11:00 (=agora)"]).toContain("erro mostrado");
});

test("R4 trocar o fuso mantém hora de parede (muda o instante)", async ({ page }) => {
  const { id } = await setup(page);
  await page.goto(`/painel/${id}/configuracoes`);
  const antes = (await events(page))[0].revealAt as number;
  // 12h00 Cuiabá -> Lisboa mantendo a hora de parede = 12:00Z, anterior ao "agora" (15:00Z): precisa ser recusado
  await page.getByLabel("Fuso horário").selectOption("Europe/Lisbon");
  const resumoLisboa = (await page.getByTestId("config-revelacao").locator(".app-card").innerText()).replace(/\s+/g, " ");
  await page.getByRole("button", { name: "Salvar revelação" }).click();
  await page.waitForTimeout(500);
  const msgLisboa = (await page.getByTestId("config-revelacao").locator("[role=status]").allInnerTexts()).join(" | ") + " | alertas: " + (await page.getByTestId("config-revelacao").locator("[role=alert]").allInnerTexts()).join(" | ");
  const aposLisboa = (await events(page))[0];
  // Rio Branco (UTC-5): mesma hora de parede, instante 1h depois
  await page.getByLabel("Fuso horário").selectOption("America/Rio_Branco");
  const resumo = (await page.getByTestId("config-revelacao").locator(".app-card").innerText()).replace(/\s+/g, " ");
  await page.getByRole("button", { name: "Salvar revelação" }).click();
  await expect(page.getByText("Revelação salva.")).toBeVisible();
  const depois = (await events(page))[0];
  rec.R4 = { antes: new Date(antes).toISOString(), lisboa_resumo: resumoLisboa, lisboa_mensagem: msgLisboa, lisboa_persistiu_revealAt: new Date(aposLisboa.revealAt as number).toISOString(), depois_rio_branco: new Date(depois.revealAt as number).toISOString(), tz: depois.timezone, resumo_apos_troca: resumo, deslocamento_h: ((depois.revealAt as number) - antes) / 3_600_000 };
  await shot(page, "r4-troca-fuso");
  expect((depois.revealAt as number) - antes).not.toBe(0);
});

test("R5 relógio atrasado depois da revelação: status regride?", async ({ page }) => {
  const { code, id } = await setup(page);
  await switchPerson(page, code, "Ana");
  await page.clock.setFixedTime(REVEAL + 5000);
  await page.reload();
  await page.waitForTimeout(600);
  const rev1 = { guest_waiting: await waiting(page).isVisible(), stored: (await events(page))[0].revealStatus };
  await page.clock.setFixedTime(BASE + 60_000);
  await page.reload();
  await page.waitForTimeout(800);
  const rev2 = { guest_waiting: await waiting(page).isVisible(), stored: (await events(page))[0].revealStatus };
  // organizador consegue editar de novo?
  await switchPerson(page, code, "Ana"); // garantia de sessão
  rec.R5 = { depois_da_revelacao: rev1, relogio_voltou: rev2 };
  await shot(page, "r5-regride");
  expect(rev1.guest_waiting).toBe(false);
});

test("R5b relógio atrasado: organizador volta a poder editar e a transição reaparece", async ({ page }) => {
  const { id, code } = await setup(page);
  await page.clock.setFixedTime(REVEAL + 5000);
  await page.goto(`/painel/${id}/configuracoes`);
  const travado = await page.getByText("A revelação aconteceu em").isVisible();
  await page.clock.setFixedTime(BASE + 60_000);
  await page.reload();
  await page.waitForTimeout(500);
  const editavel = await page.getByRole("button", { name: "Salvar revelação" }).isVisible();
  rec.R5b = { travado_apos_revelar: travado, editavel_com_relogio_atrasado: editavel };
  expect(travado).toBe(true);
  void code;
});

test("R6/R7 duas abas, transição sem recarregar, entrada tardia, reduced-motion", async ({ page, context }) => {
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  await expect(waiting(page)).toBeVisible();
  const b = await context.newPage();
  await b.goto(`/e/${code}/explorar`);
  await expect(waiting(b)).toBeVisible();
  await page.evaluate(() => ((window as unknown as { __m: number }).__m = 42));
  await page.clock.fastForward(3_600_000 + 5000);
  const t0 = Date.now();
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible({ timeout: 5000 });
  const aparecePorTimer = Date.now() - t0;
  await expect(page.getByRole("button", { name: "Ver as fotos" })).toBeVisible({ timeout: 6000 });
  const focoNoDialogo = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
  await shot(page, "r7-transicao");
  await page.getByRole("button", { name: "Ver as fotos" }).click();
  const marker = await page.evaluate(() => (window as unknown as { __m: number }).__m);
  const imgs = await page.locator("img[alt^='Foto de']").count();
  const outraAba = { aguardando: await waiting(b).isVisible(), dialogo: await b.getByTestId("transicao-revelacao").isVisible(), fotos: await b.locator("img[alt^='Foto de']").count() };
  // quem entra depois da revelação
  const c = await context.newPage();
  await switchPerson(c, code, "Beto");
  await c.waitForTimeout(500);
  const tardio = { dialogo: await c.getByTestId("transicao-revelacao").isVisible(), aguardando: await waiting(c).isVisible(), fotos: await c.locator("img[alt^='Foto de']").count() };
  rec.R6_R7 = { sem_recarregar_marker: marker, fotos_apos_transicao: imgs, ms_ate_dialogo: aparecePorTimer, foco_no_dialogo_ao_concluir: focoNoDialogo, outra_aba: outraAba, entrou_depois: tardio };
  expect(marker).toBe(42);
  expect(imgs).toBeGreaterThan(0);
  expect(tardio.dialogo).toBe(false);
});

test("R7b reduced-motion: transição imediata", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", permissions: ["camera"] });
  const page = await ctx.newPage();
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  await page.clock.fastForward(3_600_000 + 5000);
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible({ timeout: 5000 });
  const t0 = Date.now();
  await expect(page.getByRole("button", { name: "Ver as fotos" })).toBeVisible({ timeout: 3000 });
  rec.R7b_reduced_motion_ms_ate_botao = Date.now() - t0;
  await ctx.close();
});

test("R8 postagem durante a revelação e exatamente em revealAt", async ({ page, context }) => {
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  // Ana abre /postar antes, o relógio passa, publica depois
  const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
  await page.goto(`/e/${code}/postar`);
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG });
  await page.clock.fastForward(3_600_000 + 5000);
  const t0 = Date.now();
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
  const modalSobrePostagem = true;
  const cliqueBloqueado = await page.getByRole("button", { name: "Postar", exact: true }).click({ timeout: 1500 }).then(() => false, () => true);
  await page.getByRole("button", { name: "Ver as fotos" }).click({ timeout: 6000 });
  const msAteLiberar = Date.now() - t0;
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();
  const msgEscuro = await page.getByTestId("guardada-no-escuro").isVisible();
  // exatamente em revealAt (em outro evento)
  const ctx2 = await context.browser()!.newContext({ permissions: ["camera"] });
  const p2 = await ctx2.newPage();
  const s2 = await setup(p2);
  await switchPerson(p2, s2.code, "Caio");
  await p2.clock.setFixedTime(REVEAL);
  await p2.goto(`/e/${s2.code}/postar`);
  await p2.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "f.png", mimeType: "image/png", buffer: PNG });
  await p2.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(p2.getByText("Sua visão entrou na história.")).toBeVisible();
  const msgEscuroExato = await p2.getByTestId("guardada-no-escuro").isVisible();
  await p2.goto(`/e/${s2.code}/agora`);
  await p2.waitForTimeout(500);
  rec.R8 = { modal_sobre_postagem_em_andamento: modalSobrePostagem, clique_em_Postar_bloqueado_pelo_modal: cliqueBloqueado, ms_ate_poder_postar: msAteLiberar, reveal_durante_post_mostra_guardada_no_escuro: msgEscuro, post_em_revealAt_mostra_guardada_no_escuro: msgEscuroExato, fotos_no_agora_em_revealAt: await p2.locator("img[alt^='Foto de']").count() };
  await ctx2.close();
});

test("R9 evento encerrado antes da revelação ('ao terminar'); convidado que já estava dentro", async ({ page }) => {
  const { code, id } = await setup(page, { reveal: "ao-terminar" });
  await switchPerson(page, code, "Ana");
  const antes = (await events(page))[0];
  await asPerson(page, "Emy");
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "Encerrar agora" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Encerrar agora" }).click();
  await page.waitForTimeout(500);
  const ap = (await events(page))[0];
  await asPerson(page, "Ana");
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(600);
  const e1 = { encerrado: await page.getByText("Encerrado", { exact: true }).first().isVisible(), aguardando: await waiting(page).isVisible(), contagem: await page.getByTestId("contagem").innerText().catch(() => "") };
  await shot(page, "r9-encerrado-antes");
  await page.goto(`/e/${code}/retrospectiva`);
  const retro = await page.getByText("A retrospectiva ainda não abriu.").isVisible();
  // postar depois de encerrado
  await page.goto(`/e/${code}/postar`);
  const postar = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 80);
  // chega a hora planejada
  await page.clock.fastForward(6 * 3_600_000 + 5000);
  await page.goto(`/e/${code}/retrospectiva`);
  await page.waitForTimeout(500);
  const retroDepois = await page.getByText("A retrospectiva ainda não abriu.").isVisible();
  // entrar depois de encerrado (quem nunca entrou)
  await switchPerson(page, code, "Tardio").then(() => "entrou", () => "recusado/erro").then((r) => (rec.R9_tardio_apos_encerrar = r));
  rec.R9_ao_terminar = { revealAt_inicial: new Date(antes.revealAt as number).toISOString(), endedAt: new Date(ap.endedAt as number).toISOString(), revealAt_depois_de_encerrar: new Date(ap.revealAt as number).toISOString(), horas_de_espera_apos_encerrar: +(((ap.revealAt as number) - (ap.endedAt as number)) / 3_600_000).toFixed(2), convidado_logo_apos_encerrar: e1, retrospectiva_fechada_logo_apos: retro, postar_apos_encerrar: postar, retrospectiva_fechada_apos_horario_planejado: retroDepois };
});

test("R9b mudar o fim do evento não move a revelação 'ao terminar'", async ({ page }) => {
  const { id } = await setup(page, { reveal: "ao-terminar" });
  const antes = (await events(page))[0];
  await page.goto(`/painel/${id}/configuracoes`);
  await page.getByRole("button", { name: "1 dia" }).click();
  await page.waitForTimeout(400);
  const dep = (await events(page))[0];
  const end = (dep.startAt as number) + (dep.durationHours as number) * 3_600_000;
  rec.R9b = { revealAt: new Date(dep.revealAt as number).toISOString(), novo_fim: new Date(end).toISOString(), revealAt_mudou: dep.revealAt !== antes.revealAt, revela_antes_do_fim_horas: (end - (dep.revealAt as number)) / 3_600_000 };
});

test("R10 reabrir depois da revelação, app fechado na hora, offline", async ({ page, context }) => {
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  await page.close();
  const p2 = await context.newPage();
  await p2.clock.setFixedTime(REVEAL + 3_600_000);
  await p2.goto(`/e/${code}/agora`);
  await p2.waitForTimeout(800);
  const reaberto = { dialogo: await p2.getByTestId("transicao-revelacao").isVisible(), aguardando: await waiting(p2).isVisible(), fotos: await p2.locator("img[alt^='Foto de']").count(), stored: (await events(p2))[0].revealStatus };
  // offline: nova festa, aba aberta, rede cai, hora passa
  const ctx3 = await context.browser()!.newContext({ permissions: ["camera"] });
  const p3 = await ctx3.newPage();
  const s3 = await setup(p3);
  await switchPerson(p3, s3.code, "Duda");
  await expect(waiting(p3)).toBeVisible();
  await ctx3.setOffline(true);
  await p3.clock.fastForward(3_600_000 + 5000);
  await expect(p3.getByTestId("transicao-revelacao")).toBeVisible({ timeout: 5000 });
  await p3.getByRole("button", { name: "Ver as fotos" }).click();
  const offline = { banner_sem_sinal: await p3.getByText("Sem sinal agora").isVisible(), fotos: await p3.locator("img[alt^='Foto de']").count() };
  await shot(p3, "r10-offline-revelado");
  await ctx3.setOffline(false);
  rec.R10 = { reabrir_apos: reaberto, offline };
  expect(reaberto.dialogo).toBe(false);
  await ctx3.close();
});

test("R11 editar depois de revelada; ligar com fotos visíveis; desligar com fotos bloqueadas", async ({ page }) => {
  // (a) desligada + foto -> ligar
  const a = await setup(page, { reveal: "desligada" });
  await page.goto(`/painel/${a.id}/configuracoes`);
  await page.getByRole("group", { name: "Revelação programada" }).getByRole("button", { name: /^Ligada/ }).click();
  await page.getByRole("button", { name: "Salvar revelação" }).click();
  await page.waitForTimeout(500);
  const ligar = await page.getByText(/Este evento já tem fotos visíveis/).first().isVisible();
  // (b) ligada pendente + foto -> desligar: convidado passa a ver
  await page.goto("/");
  const b = await createViaWizard(page, { reveal: { date: "2026-11-10", time: "12:00", tz: "America/Cuiaba" }, title: "B" });
  await postViaFile(page, b.code);
  await page.goto(`/painel/${b.id}/configuracoes`);
  await page.getByRole("group", { name: "Revelação programada" }).getByRole("button", { name: /^Desligada/ }).click();
  await page.getByRole("button", { name: "Salvar revelação" }).click();
  await expect(page.getByText("Revelação salva.")).toBeVisible();
  await switchPerson(page, b.code, "Ana");
  await page.waitForTimeout(500);
  const desligar = { fotos_visiveis_para_convidado: await page.locator("img[alt^='Foto de']").count(), aguardando: await waiting(page).isVisible() };
  // (c) depois de revelada
  const c = await setup(page).catch(() => undefined);
  void c;
  rec.R11 = { ligar_com_fotos_visiveis_bloqueado: ligar, desligar_com_fotos_bloqueadas: desligar };
  expect(ligar).toBe(true);
});

test("R12 acessibilidade da espera e da transição (axe, role=timer, foco)", async ({ page }) => {
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  const timer = page.getByRole("timer");
  const attrs = { role_timer: await timer.count(), aria_live: await timer.getAttribute("aria-live"), sr_polite: await page.locator(".rv-sr-only[aria-live=polite]").innerText() };
  const axe1 = await new AxeBuilder({ page }).analyze();
  await page.clock.fastForward(3_600_000 + 5000);
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
  const foco0 = await page.evaluate(() => document.activeElement?.tagName + "." + (document.activeElement?.getAttribute("class") ?? "").slice(0, 30));
  const axe2 = await new AxeBuilder({ page }).analyze();
  rec.R12 = { attrs, axe_espera: axe1.violations.map((v) => `${v.id}:${v.impact}:${v.nodes.length}`), axe_transicao: axe2.violations.map((v) => `${v.id}:${v.impact}:${v.nodes.length}`), foco_enquanto_revela: foco0 };
  void computeRevealStatus;
});

test("R13 aba que acorda depois de revealAt (sem timer disparado): contagem zerada e ainda 'Aguardando'?", async ({ page }) => {
  const { code } = await setup(page);
  await switchPerson(page, code, "Ana");
  await expect(waiting(page)).toBeVisible();
  await page.clock.setFixedTime(REVEAL + 2000); // o relógio avança, mas nenhum timer da aba é disparado (aba em segundo plano/suspensa)
  await page.waitForTimeout(2500);
  const contagem = await page.getByTestId("contagem").innerText().catch(() => "(sumiu)");
  const aguardando = await waiting(page).isVisible();
  await page.waitForTimeout(14_000);
  const aposQuinzeSegundos = { aguardando: await waiting(page).isVisible(), dialogo: await page.getByTestId("transicao-revelacao").isVisible() };
  rec.R13 = { apos_2_5s_contagem: contagem, apos_2_5s_ainda_aguardando: aguardando, apos_16s: aposQuinzeSegundos };
  await shot(page, "r13-contagem-zerada");
});
