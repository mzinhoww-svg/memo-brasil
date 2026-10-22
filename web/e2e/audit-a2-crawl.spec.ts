/* Auditoria A2 (visual): percorre todas as rotas em 375/390/768/1440 nos temas dia/noite, captura screenshots e métricas.
 * Escreve só em docs/audit/evidence/**. Não altera o produto. */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ANALYZE } from "./audit-a2-analyze";
import { createViaWizard, setTheme } from "./helpers";

const EV = path.resolve(__dirname, "../../docs/audit/evidence");
const SHOTS = path.join(EV, "screenshots");
const RES = path.join(EV, "test-results");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(RES, { recursive: true });
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));

const VPS = [{ w: 375, h: 812 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }];
const LONG_TITLE = "Casamento de Maria Eduarda e João Pedro Albuquerque Neto";
const LONG_NAME = "Maria Eduarda de Albuquerque e Souza Pereira";
const CAPTION = "Ninguém segurou a emoção quando o pai da noiva entrou na pista e puxou a dança com toda a família junto, valeu demais.".slice(0, 140);
const MAIN = new Set(["home", "entrar", "criar-1", "agora", "explorar", "voce", "postar", "painel", "revelacao-espera", "revelacao-galeria"]);

for (const vp of VPS) {
  for (const theme of ["dia", "noite"] as const) {
    test(`crawl ${vp.w} ${theme}`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setTheme(page, theme);
      const results: Record<string, unknown> = {};
      const consoleMsgs: { route: string; type: string; text: string }[] = [];
      let current = "init";
      page.on("console", (m) => { if (["error", "warning"].includes(m.type())) consoleMsgs.push({ route: current, type: m.type(), text: m.text().slice(0, 300) }); });
      page.on("pageerror", (e) => consoleMsgs.push({ route: current, type: "pageerror", text: String(e).slice(0, 300) }));

      async function snap(name: string, opts: { full?: boolean; analyze?: boolean } = {}) {
        current = name;
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const keep = (vp.w === 390 || vp.w === 1440) || MAIN.has(name);
        if (keep) await page.screenshot({ path: path.join(SHOTS, `a2-${name}-${vp.w}-${theme}.png`), animations: "disabled", fullPage: !!opts.full });
        if (opts.analyze !== false) results[name] = { url: page.url().replace(/^https?:\/\/[^/]+/, ""), ...(await page.evaluate(ANALYZE)) as object };
      }

      // 1. rotas públicas
      await page.goto("/"); await snap("home");
      await page.goto("/entrar"); await snap("entrar");
      await page.getByLabel("Código da festa").fill("ZZZZZZZZ");
      await page.getByRole("button", { name: /Entrar|Continuar|Abrir/ }).first().click().catch(() => undefined);
      await page.waitForTimeout(300); await snap("entrar-erro");

      // 2. wizard passo a passo
      await page.goto("/criar"); await snap("criar-1");
      await page.getByLabel("Nome que os convidados vão ver").fill(LONG_TITLE);
      for (let i = 2; i <= 4; i++) { await page.getByRole("button", { name: "Continuar" }).click(); await snap(`criar-${i}`); }
      await page.getByRole("button", { name: /Criar evento/ }).click();
      await page.waitForURL(/\/criar\/pronto\//);
      const id = page.url().split("/").pop()!;
      await page.waitForTimeout(500);
      const code = (await page.getByTestId("codigo").textContent())!.trim();
      await snap("criar-pronto");

      // 3. post com legenda de 140
      await page.goto(`/e/${code}/postar`); await snap("postar-vazio");
      await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
      await page.getByLabel("Legenda (opcional)").fill(CAPTION);
      await snap("postar-preview");
      await page.getByRole("button", { name: "O sim", exact: true }).click();
      await page.getByRole("button", { name: "Postar", exact: true }).click();
      await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();
      await snap("postar-publicado");

      // 4. convite com novo convidado de nome longo
      await page.goto(`/e/${code}/voce`);
      await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
      await page.waitForURL(new RegExp(`/e/${code}$`));
      await snap("convite");
      await page.getByLabel("Como te chamam na festa?").fill(LONG_NAME);
      await page.getByRole("button", { name: "Entrar na festa" }).click();
      await page.waitForURL(/agora$/);
      await page.waitForTimeout(400);
      // foto do convidado
      await page.goto(`/e/${code}/postar`);
      await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
      await page.getByLabel("Legenda (opcional)").fill(CAPTION);
      await page.getByRole("button", { name: "Postar", exact: true }).click();
      await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();

      const photoId = await page.evaluate(() => new Promise<string>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const q = r.result.transaction("photos").objectStore("photos").getAllKeys(); q.onsuccess = () => res(String((q.result as string[])[0])); }; }));

      for (const r of ["agora", "explorar", "voce", "retrospectiva"]) { await page.goto(`/e/${code}/${r}`); await page.waitForTimeout(400); await snap(r); }
      await page.goto(`/e/${code}/postar`); await snap("postar");
      await page.goto(`/e/${code}/editar/${photoId}`); await page.waitForTimeout(500); await snap("editar");
      await page.goto(`/e/${code}/agora`); await page.waitForTimeout(300);
      const more = page.getByRole("button", { name: /Mais opções|Mais/ }).first();
      if (await more.count()) { await more.click(); await page.waitForTimeout(300); await snap("agora-mais-sheet"); await page.keyboard.press("Escape"); }

      // 5. painel do anfitrião: precisa do usuário Emy
      await page.goto(`/e/${code}/voce`);
      const listed = await page.getByText("Emy").count();
      void listed;
      // volta a ser anfitrião: tela inicial lista pessoas conhecidas
      await page.goto("/");
      const emy = page.getByRole("button", { name: /Emy/ }).first();
      if (await emy.count()) { await emy.click(); await page.waitForTimeout(500); }
      await snap("home-logado");
      for (const s of ["", "momentos", "qr", "conteudo", "convidados", "downloads", "configuracoes"]) {
        await page.goto(`/painel/${id}${s ? "/" + s : ""}`); await page.waitForTimeout(500);
        await snap(s ? `painel-${s}` : "painel");
      }

      // 6. utilitárias
      for (const r of ["design", "offline", "master", "rota-inexistente"]) { await page.goto("/" + r); await page.waitForTimeout(400); await snap(r === "rota-inexistente" ? "404" : r); }

      fs.writeFileSync(path.join(RES, `a2-crawl-${vp.w}-${theme}.json`), JSON.stringify({ viewport: vp, theme, results, console: consoleMsgs }, null, 1));
    });
  }
}

// 7. estados da revelação (390 e 1440 x dia/noite), com page.clock
for (const vp of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  for (const theme of ["dia", "noite"] as const) {
    test(`revelacao ${vp.w} ${theme}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setTheme(page, theme);
      const results: Record<string, unknown> = {};
      const t0 = Date.now();
      await page.clock.install({ time: t0 });
      async function snap(name: string) {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(SHOTS, `a2-${name}-${vp.w}-${theme}.png`), animations: "disabled" });
        results[name] = { url: page.url().replace(/^https?:\/\/[^/]+/, ""), ...(await page.evaluate(ANALYZE)) as object };
      }
      await page.goto("/");
      await page.goto("/dev/seed?reveal=pendente");
      await page.waitForURL(/\/agora/);
      await page.waitForTimeout(400);
      await snap("revelacao-host-agora");
      const ev = await page.evaluate(() => new Promise<{ id: string; code: string }>((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => { const q = r.result.transaction("events").objectStore("events").getAll(); q.onsuccess = () => res(q.result[0] as { id: string; code: string }); }; }));
      await page.goto(`/painel/${ev.id}/configuracoes`);
      await page.getByTestId("config-revelacao").scrollIntoViewIfNeeded();
      await snap("revelacao-config");
      const prev = page.getByRole("button", { name: "Pré-visualizar como convidado" });
      if (await prev.count()) { await prev.click(); await page.waitForTimeout(300); await snap("revelacao-previa"); await page.getByRole("button", { name: "Fechar prévia" }).click(); }
      await page.goto(`/e/${ev.code}/voce`);
      await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
      await page.waitForURL(new RegExp(`/e/${ev.code}$`));
      await page.getByLabel("Como te chamam na festa?").fill("Ana");
      await page.getByRole("button", { name: "Entrar na festa" }).click();
      await page.waitForURL(/agora$/);
      await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
      await snap("revelacao-espera");
      await page.clock.fastForward("03:00");
      await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
      await snap("revelacao-transicao");
      await expect(page.getByText("O filme foi revelado.")).toBeVisible({ timeout: 8000 });
      await snap("revelacao-revelado");
      await page.getByRole("button", { name: "Ver as fotos" }).click();
      await page.waitForTimeout(500);
      await snap("revelacao-galeria");
      fs.writeFileSync(path.join(RES, `a2-revelacao-${vp.w}-${theme}.json`), JSON.stringify({ viewport: vp, theme, results }, null, 1));
    });
  }
}
