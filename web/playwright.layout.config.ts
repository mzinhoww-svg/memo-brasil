import { defineConfig, devices } from "@playwright/test";

/**
 * Layout e fluxos de tela em celular e tablet (assistente, folhas, QR, Minhas, PWA), no Chromium e no WebKit (iOS Safari).
 * Build antes com as mesmas variáveis do CI (ver .github/workflows/ci.yml, job `layout-e2e`).
 * Local sem WebKit instalado: LAYOUT_WEBKIT=0 (só Chromium; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH aponta o binário).
 */
const port = Number(process.env.E2E_PORT ?? 3187);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) throw new Error("Os testes de layout só rodam contra um app local.");
const webkit = process.env.LAYOUT_WEBKIT !== "0";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["sheet-layout.spec.ts", "wizard-oito-passos.spec.ts", "wizard-mobile-layout.spec.ts", "nome-previa.spec.ts", "qr-layout.spec.ts", "minhas-rolagem.spec.ts", "eventos-rolagem.spec.ts", "pwa.spec.ts"],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  outputDir: "test-results/layout",
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "chromium-mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } } },
    ...(webkit ? [
      { name: "webkit-iphone-se", use: { ...devices["iPhone SE"] } },
      { name: "webkit-ipad", use: { ...devices["iPad (gen 7)"] } },
    ] : []),
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: `npx next start -H 127.0.0.1 -p ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
