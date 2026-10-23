import { defineConfig, devices } from "@playwright/test";

/** Smoke público do convidado: E2E_BASE_URL=https://... E2E_EVENT_CODE=XXXXXXXX npx playwright test -c playwright.prod-smoke.config.ts */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /prod-smoke\.spec\.ts/,
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL, ...devices["Desktop Chrome"] },
});
