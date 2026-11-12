import { expect, test } from "@playwright/test";

// Smoke SÓ DE LEITURA da home publicada (visitante): E2E_BASE_URL=https://... npx playwright test -c playwright.prod-smoke.config.ts home
// Nada é gravado: a festa de exemplo vive em memória e a câmera é falsa.
test.skip(!process.env.E2E_BASE_URL, "defina E2E_BASE_URL");
test.use({ permissions: ["camera"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

for (const size of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
  test(`home ${size.width}px: ações com destino, sem listas de eventos, sem rolagem lateral, rodapé compacto`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Experimentar câmera" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Criar meu evento grátis" })).toHaveAttribute("href", "/criar");
    await expect(page.getByRole("link", { name: "Entrar com código" })).toHaveAttribute("href", "/entrar");
    await expect(page.getByRole("heading", { name: /Seus eventos|Festas em que você entrou/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Meus eventos" })).toHaveCount(0); // visitante sem sessão
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await page.getByRole("contentinfo", { name: "Rodapé" }).boundingBox())!.height).toBeLessThan(260);
  });
}

test("festa de exemplo: liga, desliga e sai sem enviar nada ao servidor", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (r) => { if (r.method() !== "GET" && r.method() !== "HEAD" && !r.url().startsWith("data:")) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  await page.goto("/");
  await page.goto("/exemplo");
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await expect(page.getByLabel("Câmera ao vivo")).toBeVisible();
  await page.getByRole("button", { name: "Tirar foto de exemplo" }).click();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desligar a câmera" }).click();
  await expect(page.getByRole("button", { name: "Ligar a câmera" })).toBeVisible();
  await page.getByRole("link", { name: "Sair" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // RPCs de leitura públicas (linha de preço da home ao voltar) usam POST no PostgREST; qualquer outra coisa seria gravação
  const READS = /^POST \/rest\/v1\/rpc\/(list_public_plans|get_public_settings)$/;
  expect(writes.filter((w) => !w.includes("/_vercel/") && !READS.test(w))).toEqual([]);
});

test("Meus eventos sem sessão pede o Google; Entrar com código abre o formulário", async ({ page }) => {
  await page.goto("/eventos");
  await expect(page.getByRole("heading", { name: "Meus eventos", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
  await expect(page.getByRole("list")).toHaveCount(0);
  await page.getByRole("link", { name: "Entrar com código" }).click();
  await expect(page.getByRole("heading", { name: "Entrar na festa", level: 1 })).toBeVisible();
});
