import { defineConfig, devices } from "@playwright/test";

// Local fail-closed/browser regression only. This is NOT provider sandbox homologation.
const port = Number(process.env.VALIDAPAY_E2E_PORT ?? 3190);
export default defineConfig({
  testDir: "./e2e", testMatch: "validapay-local.spec.ts", workers: 1, timeout: 60000,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: `npm run start -- --hostname 127.0.0.1 --port ${port}`, port, reuseExistingServer: false, timeout: 60000 },
});
