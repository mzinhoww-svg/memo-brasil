import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/**
 * Momentos de movimento do Revela (kit do designer): disparo, contador, voo para "Minhas", virada do feed,
 * "Revelou.", câmera pronta, fotos na mesa, pago/expirou e curtir. Confere os estados finais, que as camadas de animação
 * nunca bloqueiam toque e que "reduzir movimento" chega ao fim sem animar. Também grava os vídeos de evidência
 * (390x844) em docs/evidence/movimento: disparo, virada do feed e "Revelou.".
 */
const OUT = path.resolve(__dirname, "../../docs/evidence/movimento");
const MIN = 60_000;
test.use({ viewport: { width: 390, height: 844 }, video: { mode: "on", size: { width: 390, height: 844 } }, actionTimeout: 15_000 });

let hasFfmpeg = true;
try { execFileSync("which", ["ffmpeg"], { stdio: "ignore" }); } catch { hasFfmpeg = false; }

type Cut = { name: string; from: number; to: number };
/** Fecha a página, guarda o vídeo inteiro e recorta os trechos (webm e, com ffmpeg, GIF). `from`/`to` em ms de relógio real. */
async function saveCuts(page: Page, startedAt: number, cuts: Cut[]) {
  fs.mkdirSync(OUT, { recursive: true });
  const video = page.video();
  await page.close();
  if (!video) return;
  const raw = path.join(OUT, "_bruto.webm");
  await video.saveAs(raw);
  for (const c of cuts) {
    const ss = Math.max(0, (c.from - startedAt) / 1000), len = Math.max(1, (c.to - c.from) / 1000);
    const dest = path.join(OUT, `${c.name}.webm`);
    if (!hasFfmpeg) { fs.copyFileSync(raw, dest); continue; }
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", ss.toFixed(2), "-t", len.toFixed(2), "-i", raw, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-an", dest]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", ss.toFixed(2), "-t", len.toFixed(2), "-i", raw, "-vf", "fps=15,scale=260:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer", path.join(OUT, `${c.name}.gif`)]);
  }
  fs.rmSync(raw, { force: true });
}

/** Registra cada `element.animate()` (classe do alvo) para provar que o kit rodou, sem depender de pegar a animação em andamento. */
const spyAnimate = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { __anim?: string[] };
  if (w.__anim) return;
  w.__anim = [];
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, ...a: Parameters<Element["animate"]>) {
    w.__anim!.push(`${this.tagName.toLowerCase()}.${String(this.getAttribute("class") ?? "").replace(/\s+/g, ".")}`);
    return orig.apply(this, a);
  } as typeof orig;
});
const animated = (page: Page) => page.evaluate(() => (window as unknown as { __anim?: string[] }).__anim ?? []);
const running = (page: Page, sel: string) => page.evaluate((s) => document.querySelector(s)?.getAnimations().length ?? -1, sel);
/** O canvas de confete desenhou alguma peça (algum pixel não transparente). */
const drewConfetti = (page: Page) => page.waitForFunction(() => {
  const c = document.querySelector<HTMLCanvasElement>('canvas[data-testid="confete"]');
  if (!c || !c.width) return false;
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) return true;
  return false;
}, undefined, { timeout: 4000 });

test("disparo: clarão, obturador, roda e contador rolando; a pose voa para Minhas e o visor segue livre", async ({ page }) => {
  const startedAt = Date.now();
  const { code } = await createViaWizard(page, { title: "Disparo", reveal: "desligada", shots: "5" });
  await switchPerson(page, code, "Ana");
  await page.goto(`/e/${code}/postar`);
  await expect(page.locator(".rv-counter b")).toHaveText("5");
  const shutter = page.getByRole("button", { name: "Tirar foto" });
  await expect(shutter).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".rv-flash-layer")).toHaveCount(1);
  await expect(page.locator(".rv-shutter-layer")).toHaveCount(1);
  await expect(page.locator(".rv-counter .rv-odo")).toHaveAttribute("aria-label", "05");
  await page.waitForTimeout(700);

  await spyAnimate(page);
  const from = Date.now() - 500;
  await shutter.click();
  // durante o clarão: camadas animando, sem pegar o toque, roda girando e contador já na pose seguinte
  const during = await page.evaluate(() => {
    const close = document.querySelector('.vf-top a[aria-label="Fechar câmera"]')!.getBoundingClientRect();
    const hit = document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2);
    return {
      pointer: [...document.querySelectorAll(".rv-flash-layer, .rv-shutter-layer")].map((l) => getComputedStyle(l).pointerEvents),
      closeReachable: !!hit?.closest('a[aria-label="Fechar câmera"]'),
      oldFlash: document.querySelectorAll(".flashfx").length,
    };
  });
  const kit = (await animated(page)).join(" ");
  for (const part of ["rv-flash-layer", "rv-shutter-layer", "shutter", "wheel"]) expect(kit).toContain(part);
  expect(during.pointer).toEqual(["none", "none"]);
  expect(during.closeReachable).toBe(true);
  expect(during.oldFlash).toBe(0);
  await expect(page.locator(".rv-counter .rv-odo")).toHaveAttribute("aria-label", "04");
  // a pose guardada voa até a aba (aqui, o rolo da câmera: a tela cheia não tem abas) e some
  await expect(page.locator(".rv-counter b")).toHaveText("4", { timeout: 20_000 });
  await expect(page.getByTestId("pose-voando")).toHaveCount(0, { timeout: 4000 });
  // estado final: camadas apagadas, obturador liberado, visor aberto
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".rv-flash-layer")!).opacity), { timeout: 4000 }).toBe("0");
  expect(await running(page, ".rv-flash-layer")).toBe(0);
  await expect(shutter).toBeEnabled();
  await page.waitForTimeout(600);
  await saveCuts(page, startedAt, [{ name: "disparo", from, to: Date.now() }]);
});

test("disparo com reduzir movimento: sem clarão nem giro, o contador já está certo", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", permissions: ["camera"], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const { code } = await createViaWizard(page, { title: "Disparo RM", reveal: "desligada", shots: "5" });
  await switchPerson(page, code, "Ana");
  await page.goto(`/e/${code}/postar`);
  const shutter = page.getByRole("button", { name: "Tirar foto" });
  await expect(shutter).toBeVisible({ timeout: 15_000 });
  await shutter.click();
  await expect(page.locator(".rv-counter b")).toHaveText("4", { timeout: 20_000 });
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".rv-flash-layer")!).display)).toBe("none");
  expect(await running(page, ".wheel")).toBe(0);
  expect(await running(page, ".rv-flash-layer")).toBe(0);
  await expect(page.getByTestId("pose-voando")).toHaveCount(0);
  await ctx.close();
});

test("laboratório (23b): cadeado balança, miniaturas borradas respiram e os visores são odômetros", async ({ page }) => {
  await page.goto("/dev/revela/Convidado-laboratorio");
  await expect(page.locator(".rv-lock-nudge")).toHaveCount(1);
  expect(await page.locator(".rv-blurred").count()).toBeGreaterThanOrEqual(3);
  expect(await running(page, ".rv-lock-nudge")).toBeGreaterThan(0);
  const digits = page.locator(".countdown .rvm-odo");
  await expect(digits).toHaveCount(3);
  await expect(digits.nth(0)).toHaveAttribute("aria-label", "27");
  await expect(digits.nth(1)).toHaveAttribute("aria-label", "17");
  // a fita mostra o 2 e o 7 (cada dígito sobe a fita em em)
  expect(await digits.nth(0).locator("> span > span").first().evaluate((e) => (e as HTMLElement).style.transform)).toBe("translateY(-2em)");
});

test("virada do feed: 'Revelou.' com confete e fotos na mesa; ao abrir o feed as miniaturas borradas viram fotos reais", async ({ page, context }) => {
  void context;
  const startedAt = Date.now();
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  const d = new Date(t0 + 3 * MIN);
  const { code } = await createViaWizard(page, { title: "Virada", reveal: { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" } });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByText("NO LABORATÓRIO")).toBeVisible();
  await page.waitForTimeout(500);

  await spyAnimate(page);
  const revelouFrom = Date.now();
  await page.clock.fastForward("04:00");
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
  const title = page.getByRole("heading", { name: "Revelou." });
  await expect(title).toBeVisible({ timeout: 6000 });
  await expect.poll(async () => (await animated(page)).some((a) => a.startsWith("h1.rv-display")), { timeout: 4000 }).toBe(true);
  expect((await animated(page)).filter((a) => a.includes("rv-print")).length).toBe(1); // as fotos caem na mesa
  await drewConfetti(page);
  await expect(page.locator('[data-testid="transicao-revelacao"] .table .rv-print')).toHaveCount(1);
  // o botão e o toque seguem livres por cima do confete
  const canvasPointer = await page.locator('canvas[data-testid="confete"]').evaluate((c) => getComputedStyle(c).pointerEvents);
  expect(canvasPointer).toBe("none");
  await page.waitForTimeout(2800);

  const viradaFrom = Date.now();
  await page.getByRole("button", { name: "Abrir o feed" }).click();
  await expect(page.getByText("NO LABORATÓRIO")).toHaveCount(0);
  // a foto chega borrada e com cadeado, e a virada troca pela real
  const post = page.locator("article.post").first();
  await expect(post).toBeVisible();
  await expect(page.locator("article.post .rv-print img.rv-blurred, article.post .rvm-lock")).toHaveCount(0, { timeout: 8000 });
  await expect(post.locator(".rv-print img")).toBeVisible();
  await expect.poll(() => post.locator(".rv-print img").evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(1);
  await page.waitForTimeout(1200);
  await saveCuts(page, startedAt, [
    { name: "revelou", from: revelouFrom, to: viradaFrom + 600 },
    { name: "virada-feed", from: viradaFrom - 300, to: Date.now() },
  ]);
});

test("virada do feed com reduzir movimento: já abre com a foto real, sem cadeado", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", permissions: ["camera"], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  const d = new Date(t0 + 3 * MIN);
  const { code } = await createViaWizard(page, { title: "Virada RM", reveal: { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" } });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByText("NO LABORATÓRIO")).toBeVisible();
  await page.clock.fastForward("04:00");
  await expect(page.getByRole("heading", { name: "Revelou." })).toBeVisible({ timeout: 6000 });
  await page.getByRole("button", { name: "Abrir o feed" }).click();
  await expect(page.locator("article.post")).toHaveCount(1);
  await expect(page.locator("article.post .rv-blurred, article.post .rvm-lock")).toHaveCount(0, { timeout: 5000 });
  await ctx.close();
});

test("curtir e reagir: o coração estoura e a curtida vale", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "Curtir", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  const post = page.locator("article.post").first();
  const like = post.getByRole("button", { name: "Curtir" });
  await like.click();
  const anim = await like.evaluate((b) => b.getAnimations({ subtree: true }).length);
  expect(anim).toBeGreaterThan(0);
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(post.getByText("1 curtida")).toBeVisible();
  // 24f: foto aberta revela (rv-develop) na primeira vez e a reação também estoura
  await post.getByRole("button", { name: /Abrir a foto de Ana/ }).click();
  await expect(page.locator(".reacbar")).toBeVisible();
  await expect(page.locator(".rv-print img.rv-develop")).toHaveCount(1);
  const uau = page.getByRole("button", { name: /^Uau/ });
  await uau.click();
  expect(await uau.evaluate((b) => b.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await expect(uau).toHaveAttribute("aria-pressed", "true");
});

test("galeria dos revelados (18): as fotos caem na mesa e a foto aberta (19) revela uma vez", async ({ page }) => {
  await page.goto("/dev/revela/Revelados-galeria");
  const prints = page.locator(".table .rv-print");
  await expect(prints).toHaveCount(5);
  expect(await prints.first().evaluate((e) => e.getAnimations().length)).toBeGreaterThan(0);
  // estado final: cada foto na própria posição, com o giro do desenho
  await expect.poll(() => prints.first().evaluate((e) => e.getAnimations().length), { timeout: 4000 }).toBe(0);
  expect(await prints.nth(1).evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  expect(await prints.nth(1).evaluate((e) => getComputedStyle(e).transform)).not.toBe("none");
  await page.goto("/dev/revela/Revelados-foto");
  await expect(page.locator(".rv-print img")).toBeVisible();
});

test("câmera pronta (15): confete em canvas por cima, sem bloquear os botões", async ({ page }) => {
  await page.goto("/dev/revela/Camera-pronta");
  await drewConfetti(page);
  await expect(page.locator('img[src*="obj-confetti"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Compartilhar convite/ })).toBeVisible();
  const reachable = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Compartilhar/.test(x.textContent ?? ""))!.getBoundingClientRect();
    return !!document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest("button");
  });
  expect(reachable).toBe(true);
});

test("pago (14f): carimbo bate no papel e o confete estoura; recusado/expirou carimba sem confete", async ({ page }) => {
  await page.goto("/dev/revela/Pagamento-aprovado");
  const pago = page.getByTestId("carimbo-pago");
  await expect(pago).toBeVisible();
  await expect(pago).toHaveClass(/rv-stamp-slam/);
  await drewConfetti(page);
  await expect(page.locator('img[src*="obj-confetti"]')).toHaveCount(0);
  await expect.poll(() => page.locator(".rv-group").evaluate((e) => e.classList.contains("rv-shake")), { timeout: 2000 }).toBe(true);
  await expect(page.getByRole("button", { name: /Ver a câmera pronta/ })).toBeVisible();

  await page.goto("/dev/revela/Pagamento-falhou");
  const mark = page.getByTestId("carimbo-falha");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveClass(/rv-stamp-slam/);
  await expect(page.locator('canvas[data-testid="confete"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pagar com Pix" })).toBeVisible();
  // estado final do carimbo: assentado no centro do papel
  await page.waitForTimeout(600);
  expect(await mark.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
});

test("'Revelou.' (24c) em desenvolvimento: título, fotos e confete; com reduzir movimento só aparece", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/dev/revela/Feed-revelou");
  await expect(page.getByRole("heading", { name: "Revelou." })).toBeVisible();
  await expect(page.locator(".table .rv-print")).toHaveCount(3);
  await page.waitForTimeout(500);
  const drawn = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas[data-testid="confete"]')!;
    if (!c.width) return false;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    return d.some((v, i) => i % 4 === 3 && v > 0);
  });
  expect(drawn).toBe(false);
  expect(await running(page, "h1.rv-display")).toBe(0);
  await ctx.close();
});
