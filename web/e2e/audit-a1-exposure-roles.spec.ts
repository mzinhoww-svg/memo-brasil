/** Auditoria A1: exposição antecipada (convidado, antes da revelação) e separação de papéis. */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";
import { createMemoryRepositories } from "../src/repositories/memory";
import { react } from "../src/features/photos/service";
import { visiblePhotos } from "../src/domain/photo";

test.use({ actionTimeout: 10_000, navigationTimeout: 20_000 });
const EV = path.resolve(__dirname, "../../docs/audit/evidence");
const BASE = Date.parse("2026-11-10T15:00:00Z");
const FILE = `${EV}/test-results/a1-exposure-roles.json`;
const rec = new Proxy({} as Record<string, unknown>, { set(_t, k: string, v) { let o: Record<string, unknown> = {}; try { o = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* novo */ } o[k] = v; fs.writeFileSync(FILE, JSON.stringify(o, null, 2)); return true; } });
const shot = (page: Page, n: string) => page.screenshot({ path: `${EV}/screenshots/a1-${n}.png`, fullPage: true });

const idbPhotos = (page: Page) => page.evaluate(() => new Promise<{ id: string; caption?: string; authorName: string }[]>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const g = db.transaction("photos").objectStore("photos").getAll(); g.onsuccess = () => { res(g.result); db.close(); }; }; }));
const idbEvents = (page: Page) => page.evaluate(() => new Promise<{ id: string; hostId: string }[]>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const g = db.transaction("events").objectStore("events").getAll(); g.onsuccess = () => { res(g.result); db.close(); }; }; }));

async function scenario(page: Page, reveal: Parameters<typeof createViaWizard>[1]["reveal"] = { date: "2026-11-10", time: "12:00", tz: "America/Cuiaba" }) {
  await page.addInitScript(() => {
    const w = window as unknown as { __blobs: string[] };
    w.__blobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (o: Blob | MediaSource) => { const u = orig(o); w.__blobs.push(u); return u; };
  });
  await page.clock.install({ time: BASE });
  const { code, id } = await createViaWizard(page, { reveal, title: "Segredo" });
  await postViaFile(page, code, "O sim");
  await page.getByRole("button", { name: "Postar outra" }).click().catch(() => undefined);
  await switchPerson(page, code, "Ana");
  return { code, id };
}

test("E1 convidado antes da revelação: nenhuma foto bloqueada em img, blob, DOM, SW/cache, rede", async ({ page }) => {
  const reqs: string[] = [];
  page.on("request", (r) => reqs.push(r.url()));
  const { code } = await scenario(page);
  const [photo] = await idbPhotos(page);
  const out: Record<string, unknown> = {};
  for (const route of ["agora", "explorar", "voce", "retrospectiva", `editar/${photo.id}`]) {
    await page.goto(`/e/${code}/${route}`);
    await page.waitForTimeout(700);
    out[route] = {
      img_total: await page.locator("img").count(),
      img_blob_ou_foto: await page.locator("img[src^='blob:'], img[alt^='Foto de'], img[alt^='Sua foto']").count(),
      html_contem_id_da_foto: (await page.content()).includes(photo.id),
      texto: (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 220),
      blobs_criados: await page.evaluate(() => (window as unknown as { __blobs: string[] }).__blobs.length),
    };
  }
  await shot(page, "e1-explorar-bloqueado");
  // /postar: prévia só da foto recém-capturada pelo próprio convidado
  await page.goto(`/e/${code}/postar`);
  out.postar_antes_de_capturar = { img: await page.locator("img").count() };
  // SW + cache
  const caches = await page.evaluate(async () => { const out: Record<string, string[]> = {}; for (const k of await window.caches.keys()) out[k] = (await (await window.caches.open(k)).keys()).map((r) => new URL(r.url).pathname); return out; });
  out.cache_chaves = Object.fromEntries(Object.entries(caches).map(([k, v]) => [k, v.length]));
  out.cache_tem_foto_ou_blob = JSON.stringify(caches).match(/blob|photo|foto|\.(png|jpe?g|webp|svg)/gi)?.filter((s) => !/icon|brand|pwa/i.test(s)) ?? [];
  out.requests_de_imagem_nao_estatica = reqs.filter((u) => /\.(png|jpe?g|webp|gif)(\?|$)/.test(u) && !/\/(_next|icons|brand|pwa)\//.test(u));
  rec.E1 = out;
  for (const r of ["agora", "explorar", "voce", "retrospectiva"]) expect((out[r] as { img_blob_ou_foto: number }).img_blob_ou_foto).toBe(0);
  expect((out[`editar/${photo.id}`] as { texto: string }).texto).toContain("não está disponível");
});

test("E2 contagem e metadados na espera (everyoneSeesAll ligado vs desligado)", async ({ page }) => {
  const { code } = await scenario(page);
  await page.goto(`/e/${code}/agora`);
  const t = (await page.getByTestId("aguardando-revelacao").innerText()).replace(/\s+/g, " ");
  // quem vê o quê: nomes de autores/momentos/legendas na página?
  const html = await page.content();
  rec.E2 = { espera: t, vaza_autor_ou_momento: /Emy|O sim/.test(await page.locator("main").innerText()), html_tem_authorName_Emy: html.includes("Emy") };
});

test("E3 reação / denúncia / quem reagiu em foto bloqueada (serviço) e convidado direto", async () => {
  const repos = createMemoryRepositories();
  const now = BASE;
  const ev = { id: "e1", code: "ABCDEFGH", hostId: "host", revealEnabled: true, revealAt: now + 3_600_000, everyoneSeesAll: true, reactionsEnabled: true } as never;
  await repos.events.save(ev);
  await repos.photos.add({ id: "p1", eventId: "e1", authorId: "host", authorName: "Host", createdAt: now, moment: "x", status: "visivel", reports: 0, highlighted: false }, { bytes: new ArrayBuffer(4), type: "image/png" });
  const next = await react(repos, ev, "p1", "guest", "amei");
  const lista = await repos.photos.listByEvent("e1");
  const viaDominio = visiblePhotos(ev, lista, { id: "guest", host: false }, now);
  rec.E3 = { reacao_gravada_em_foto_bloqueada: next.length === 1, convidado_ve_pelo_dominio: viaDominio.length, repositorio_lista_tudo_sem_filtro_de_papel: lista.length };
  expect(viaDominio.length).toBe(0);
});

test("P1 convidado e outro organizador no painel; master por parâmetros; anônimo", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ["camera"] });
  const page = await ctx.newPage();
  const { code, id } = await scenario(page);
  const out: Record<string, string> = {};
  const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160);
  for (const sub of ["", "/conteudo", "/convidados", "/momentos", "/qr", "/configuracoes", "/downloads"]) {
    await page.goto(`/painel/${id}${sub}`);
    await page.waitForTimeout(500);
    out[`convidado Ana /painel/<id>${sub}`] = await body();
  }
  // segundo organizador (outro usuário local) abrindo o painel do evento do primeiro
  await switchPerson(page, code, "Zé");
  await page.goto(`/painel/${id}`);
  await page.waitForTimeout(500);
  out["outro usuário local (Zé) /painel/<id>"] = await body();
  for (const q of ["?role=master", "?admin=1", "?token=abc&role=master&admin=true"]) {
    await page.goto(`/master${q}`);
    out[`/master${q}`] = await body();
  }
  await page.goto(`/painel/${id}?role=master&admin=1`);
  await page.waitForTimeout(500);
  out["/painel/<id>?role=master (convidado)"] = await body();
  // sem identidade
  const anon = await browser.newContext();
  const pa = await anon.newPage();
  await pa.goto(`/painel/${id}`);
  await pa.waitForTimeout(500);
  out["anônimo em outro contexto (sem dados): /painel/<id>"] = (await pa.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160);
  await pa.goto(`/e/${code}/agora`);
  await pa.waitForTimeout(500);
  out["anônimo /e/<code>/agora"] = pa.url() + " | " + (await pa.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 120);
  rec.P1 = out;
  await anon.close();
  await ctx.close();
});

test("P2 manipular meta.user no IndexedDB para virar anfitrião (risco aceito pré-backend?)", async ({ page }) => {
  const { code, id } = await scenario(page);
  const ev = (await idbEvents(page))[0];
  // Ana atual; reescreve meta.user com o id do anfitrião (hostId é legível no próprio evento)
  await page.evaluate((hostId) => new Promise<void>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const db = r.result; const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put({ id: hostId, name: "Intruso", createdAt: 1 }, "user"); tx.oncomplete = () => { db.close(); res(); }; }; }), ev.hostId);
  await page.goto(`/painel/${id}`);
  await page.waitForTimeout(600);
  const painel = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 120);
  await page.goto(`/e/${code}/agora`);
  await page.waitForTimeout(700);
  rec.P2 = { painel_abre_para_quem_forja_hostId: painel, agora_mostra_fotos_antes_da_revelacao: await page.locator("img[alt^='Foto de']").count(), hostId_exposto_no_evento: ev.hostId };
});

test("P3 convidado fora da lista de participantes cai no convite", async ({ page, browser }) => {
  const { code } = await scenario(page);
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto("/");
  await p.goto("/dev/seed");
  await p.waitForURL(/agora/);
  await p.goto(`/e/${code}/agora`); // evento inexistente neste contexto
  await p.waitForTimeout(500);
  rec.P3 = { outro_contexto_codigo_alheio: (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 100) };
  await ctx.close();
});

test("E4 convidado que postou antes da revelação não vê as próprias fotos (Você, Agora, Postar publicada)", async ({ page }) => {
  const { code } = await scenario(page);
  await postViaFile(page, code, "Pista"); // Ana posta
  const publicada = { imgs: await page.locator("img").count(), aviso: await page.getByTestId("guardada-no-escuro").innerText() };
  await page.goto(`/e/${code}/voce`);
  await page.waitForTimeout(500);
  const voce = { img: await page.locator(".app-thumb img").count(), tiles: await page.locator(".app-thumb").count(), selo: await page.locator(".app-thumb-badge").allInnerTexts(), blobs: await page.evaluate(() => (window as unknown as { __blobs: string[] }).__blobs.length) };
  await page.goto(`/e/${code}/agora`);
  const agora = { espera: await page.getByTestId("aguardando-revelacao").innerText().then((t) => t.replace(/\s+/g, " ")), imgs: await page.locator("img").count() };
  await shot(page, "e4-voce-guardada");
  rec.E4 = { publicada, voce, agora };
  expect(voce.img).toBe(0);
});
