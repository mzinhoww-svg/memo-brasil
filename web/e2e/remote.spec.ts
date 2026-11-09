import { expect, test } from "@playwright/test";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

test.skip(!process.env.E2E_BASE_URL, "defina E2E_BASE_URL");

// Preview protegido: E2E_SHARE=<token do link temporário> libera o contexto (cookie) antes de cada teste. Nunca versionar o token.
test.beforeEach(async ({ page }) => {
  if (process.env.E2E_SHARE) await page.goto(`/?_vercel_share=${process.env.E2E_SHARE}`);
});

test("publicado: home, fontes, tema, manifest e service worker", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seu evento pelo olhar de cada convidado." })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 20px "Bricolage Grotesque"'))).toBe(true);
  await page.getByRole("button", { name: "Mudar para o tema Noite" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "noite");
  const m = await (await page.request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("Revela");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBeGreaterThan(0);
});

test("publicado: criar evento, entrar como convidado, postar e reagir", async ({ page }) => {
  const { code, id } = await createViaWizard(page, { reveal: "desligada", title: "Smoke publicado" });
  await expect(page.getByAltText(/QR Code do convite/)).toBeVisible();
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByText("Visão de Ana")).toBeVisible();
  await page.getByRole("button", { name: /^Amei/ }).click();
  await expect(page.getByRole("button", { name: /^Amei/ })).toHaveAttribute("aria-pressed", "true");
  expect(id).toBeTruthy();
});

test("publicado: painel e rota inexistente offline", async ({ page, context }) => {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/agora/);
  await expect(page.getByText("12 fotos")).toBeVisible();
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.goto("/rota-nunca-visitada");
  await expect(page.getByRole("heading", { name: "Sem sinal agora." })).toBeVisible();
  await context.setOffline(false);
});


test("publicado: headers de segurança, 404 em português e relógio de teste fora do bundle", async ({ page, request }) => {
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["permissions-policy"]).toContain("camera=(self)");

  const nf = await page.goto("/rota-que-nao-existe");
  expect(nf?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Essa página não existe." })).toBeVisible();

  // relógio de teste: nenhum chunk servido pode conter o gancho
  await page.goto("/");
  const chunks = await page.evaluate(() => [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map((s) => s.src));
  let leaked = 0;
  for (const src of chunks) {
    const body = await (await request.get(src, { headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } })).text();
    if (body.includes("mm-agora")) leaked++;
  }
  expect(chunks.length).toBeGreaterThan(0);
  expect(leaked).toBe(0);
});

test("publicado: revelação programada (espera, contagem, revelação sem rede) com relógio do navegador", async ({ page, context }) => {
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  const d = new Date(t0 + 3 * 60_000);
  const { code } = await createViaWizard(page, { title: "Revelação publicada", reveal: { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), tz: "UTC" } });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
  await expect(page.getByTestId("contagem")).toContainText(/\d{2}h \d{2}min \d{2}s/);
  await expect(page.locator(".rv-media img")).toHaveCount(0);
  await context.setOffline(true);
  await page.clock.fastForward("04:00");
  await expect(page.getByTestId("transicao-revelacao")).toBeVisible();
  await page.getByRole("button", { name: "Ver as fotos" }).click({ timeout: 8000 });
  await expect(page.locator(".rv-media img").first()).toBeVisible();
  await context.setOffline(false);
});
